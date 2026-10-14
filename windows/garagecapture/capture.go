// Package garagecapture extracts the real iRacing SessionInfo CarSetup stanza.
// It never substitutes AMS generic setup slider values for SDK data.
package garagecapture

import (
 "crypto/sha256"
 "encoding/binary"
 "encoding/json"
 "errors"
 "fmt"
 "strconv"
 "strings"
 "sync"
 "time"
 "unicode/utf8"
)
const maxSessionInfoBytes=1<<20
var ErrNoSessionInfo=errors.New("iRacing: sem SessionInfo válido")
var ErrNoCarSetup=errors.New("iRacing: CarSetup ausente ou vazio")
type Capture struct {
 ID string
 Track string
 Car string
 SessionID string
 CapturedAt time.Time
 Parameters map[string]any
}
func ReadSessionInfo(buf []byte)(uint32,string,error){
 if len(buf)<48||binary.LittleEndian.Uint32(buf[4:8])&1==0{return 0,"",ErrNoSessionInfo}
 n:=uint64(binary.LittleEndian.Uint32(buf[16:20]))
 offset:=uint64(binary.LittleEndian.Uint32(buf[20:24]))
 if n<10||n>maxSessionInfoBytes||offset<48||offset+n>uint64(len(buf)){return 0,"",ErrNoSessionInfo}
 text:=strings.TrimRight(string(buf[offset:offset+n]),"\x00")
 if len(text)==0||!utf8.ValidString(text){return 0,"",ErrNoSessionInfo}
 return binary.LittleEndian.Uint32(buf[12:16]),text,nil
}
// ParseCarSetup supports nested YAML mappings and preserves original value/unit
// strings. Lists and ambiguous YAML fail closed, rather than guessing values.
func ParseCarSetup(text string)(map[string]any,error){
 if len(text)>maxSessionInfoBytes||!utf8.ValidString(text){return nil,ErrNoCarSetup}
 root:=map[string]any{}
 type frame struct{indent int; values map[string]any}
 frames:=[]frame{{-1,root}}
 found:=false
 for _,line:=range strings.Split(strings.ReplaceAll(text,"\r\n","\n"),"\n"){
  if strings.TrimSpace(line)==""||strings.HasPrefix(strings.TrimSpace(line),"#"){continue}
  indent:=len(line)-len(strings.TrimLeft(line," "))
  trimmed:=strings.TrimSpace(line)
  if indent==0{
   if found{break}
   if trimmed=="CarSetup:"{found=true}
   continue
  }
  if !found{continue}
  if strings.Contains(line[:indent],"\t")||strings.HasPrefix(trimmed,"- "){return nil,errors.New("CarSetup: sintaxe YAML não suportada")}
  colon:=strings.Index(trimmed,":")
  if colon<1{return nil,errors.New("CarSetup: linha inválida")}
  key,value:=strings.TrimSpace(trimmed[:colon]),strings.TrimSpace(trimmed[colon+1:])
  if key==""||len(key)>100||strings.ContainsAny(key,"{}[]#"){return nil,errors.New("CarSetup: parâmetro inválido")}
  for len(frames)>1&&frames[len(frames)-1].indent>=indent{frames=frames[:len(frames)-1]}
  parent:=frames[len(frames)-1].values
  if _,exists:=parent[key];exists{return nil,errors.New("CarSetup: chave duplicada")}
  if value==""{
   child:=map[string]any{};parent[key]=child
   frames=append(frames,frame{indent,child})
  }else{
   if strings.HasPrefix(value,"|")||strings.HasPrefix(value,">")||strings.HasPrefix(value,"[")||strings.HasPrefix(value,"{"){return nil,errors.New("CarSetup: valor complexo não suportado")}
   if len(value)>=2&&value[0]=='"'&&value[len(value)-1]=='"'{if v,e:=strconv.Unquote(value);e==nil{value=v}}
   if len(value)>=2&&value[0]=='\''&&value[len(value)-1]=='\''{value=strings.ReplaceAll(value[1:len(value)-1],"''","'")}
   if len(value)>300{return nil,errors.New("CarSetup: valor demasiado longo")}
   parent[key]=value
  }
 }
 if !found||countLeaves(root)==0{return nil,ErrNoCarSetup}
 return root,nil
}
func countLeaves(m map[string]any)int{
 n:=0
 for _,v:=range m{if child,ok:=v.(map[string]any);ok{n+=countLeaves(child)}else{n++}}
 return n
}
func NewCapture(info,track,car,session string,now time.Time)(Capture,error){
 track,car,session=strings.TrimSpace(track),strings.TrimSpace(car),strings.TrimSpace(session)
 if track==""||car==""||session==""||len(track)>120||len(car)>120||len(session)>240{return Capture{},errors.New("iRacing: carro, pista ou sessão inválidos")}
 p,e:=ParseCarSetup(info);if e!=nil{return Capture{},e}
 data,e:=json.Marshal([]any{track,car,session,p});if e!=nil{return Capture{},e}
 h:=sha256.Sum256(data);h[6]=(h[6]&0x0f)|0x50;h[8]=(h[8]&0x3f)|0x80
 id:=fmt.Sprintf("%x-%x-%x-%x-%x",h[:4],h[4:6],h[6:8],h[8:10],h[10:16])
 return Capture{ID:id,Track:track,Car:car,SessionID:session,CapturedAt:now.UTC(),Parameters:p},nil
}
// Observer keeps network operations outside the 33 ms SDK polling loop.
// A failed upload is retried after RetryAfter; successful hashes are deduplicated.
type Observer struct{mu sync.Mutex;lastID string;lastTry time.Time;done map[string]bool;RetryAfter time.Duration}
func NewObserver()*Observer{return &Observer{RetryAfter:30*time.Second,done:map[string]bool{}}}
func(o *Observer)Observe(mem []byte,track,car,session string,now time.Time)(Capture,bool,error){
 _,text,e:=ReadSessionInfo(mem);if e!=nil{return Capture{},false,e}
 cap,e:=NewCapture(text,track,car,session,now);if e!=nil{return Capture{},false,e}
 o.mu.Lock();defer o.mu.Unlock()
 if o.done[cap.ID]||cap.ID==o.lastID&&now.Sub(o.lastTry)<o.RetryAfter{return Capture{},false,nil}
 o.lastID=cap.ID;o.lastTry=now
 return cap,true,nil
}
func(o *Observer)MarkUploaded(id string){o.mu.Lock();defer o.mu.Unlock();if o.done==nil{o.done=map[string]bool{}};o.done[id]=true}
