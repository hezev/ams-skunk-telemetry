// Package archive implements atomic, offline-first chunks of RAW iRacing samples.
package archive
import(
 "compress/gzip"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "strings"
 "sync"
 "time"
 "github.com/hezev/ams-skunk-telemetry/collector/internal/irsdk"
)
const MaxFramesPerChunk=256
type Envelope struct{
 Schema string `json:"schema"`
 CapturedAt time.Time `json:"capturedAt"`
 Tick int32 `json:"tick"`
 TickRate uint32 `json:"tickRate"`
 SessionInfoUpdate uint32 `json:"sessionInfoUpdate"`
 Values map[string]any `json:"rawChannels"`
}
type Metadata struct{
 Schema string `json:"schema"`
 StartedAt time.Time `json:"startedAt"`
 Context irsdk.Context `json:"context"`
 Channels []irsdk.Channel `json:"channels"`
 SampleCount int64 `json:"sampleCount"`
 Chunks int `json:"chunks"`
 MissingTicks int64 `json:"missingTicks"`
}
type Store struct{mu sync.Mutex;root,path string;meta Metadata;frames []Envelope;seenTick bool;lastTick int32}
func safeName(v string)string{
 var b strings.Builder
 for _,r:=range v{
  if r>='a'&&r<='z'||r>='A'&&r<='Z'||r>='0'&&r<='9'||r=='-'||r=='_'{b.WriteRune(r)}else if b.Len()<75{b.WriteRune('_')}
 }
 s:=b.String();if s==""{return "unknown"};if len(s)>80{return s[:80]};return s
}
func New(root string,ctx irsdk.Context,start time.Time)(*Store,error){
 if root==""{return nil,errors.New("output directory required")}
 digest:=sha256.Sum256([]byte(fmt.Sprintf("%s/%s/%s/%s/%s/%d/%s",ctx.Simulator,ctx.TrackID,ctx.Layout,ctx.CarID,ctx.SessionID,ctx.SessionNum,start.UTC().Format(time.RFC3339Nano))))
 dir:=filepath.Join(root,start.UTC().Format("2006-01-02"),safeName(ctx.Track),safeName(ctx.Car),start.UTC().Format("150405")+"_"+hex.EncodeToString(digest[:6]))
 if e:=os.MkdirAll(dir,0700);e!=nil{return nil,e}
 return &Store{root:root,path:dir,meta:Metadata{Schema:"ams.iracing.raw.v1",StartedAt:start.UTC(),Context:ctx},frames:make([]Envelope,0,MaxFramesPerChunk)},nil
}
func(s *Store)Directory()string{return s.path}
func(s *Store)Append(f irsdk.Frame,at time.Time)error{
 s.mu.Lock();defer s.mu.Unlock()
 if s.seenTick&&f.Tick==s.lastTick{return nil}
 if s.seenTick&&f.Tick>s.lastTick+1{s.meta.MissingTicks+=int64(f.Tick-s.lastTick-1)}
 s.seenTick=true;s.lastTick=f.Tick
 if len(s.meta.Channels)==0{s.meta.Channels=f.Channels}
 s.frames=append(s.frames,Envelope{Schema:"ams.iracing.sample.v1",CapturedAt:at.UTC(),Tick:f.Tick,TickRate:f.TickRate,SessionInfoUpdate:f.SessionInfoUpdate,Values:f.Values})
 if len(s.frames)>=MaxFramesPerChunk{return s.flushLocked()}
 return nil
}
func(s *Store)Flush()error{s.mu.Lock();defer s.mu.Unlock();return s.flushLocked()}
func(s *Store)flushLocked()error{
 if len(s.frames)==0{return nil}
 target:=filepath.Join(s.path,fmt.Sprintf("samples-%06d.jsonl.gz",s.meta.Chunks+1))
 tmp,e:=os.CreateTemp(s.path,".pending-*.gz");if e!=nil{return e}
 remove:=true;defer func(){tmp.Close();if remove{os.Remove(tmp.Name())}}()
 gz:=gzip.NewWriter(tmp);enc:=json.NewEncoder(gz)
 for _,f:=range s.frames{if e=enc.Encode(f);e!=nil{gz.Close();return e}}
 if e=gz.Close();e!=nil{return e}
 if e=tmp.Sync();e!=nil{return e}
 if e=tmp.Close();e!=nil{return e}
 if e=os.Rename(tmp.Name(),target);e!=nil{return e}
 remove=false
 s.meta.Chunks++;s.meta.SampleCount+=int64(len(s.frames));s.frames=s.frames[:0]
 return s.saveMetadataLocked()
}
func(s *Store)saveMetadataLocked()error{
 data,e:=json.MarshalIndent(s.meta,"","  ");if e!=nil{return e}
 tmp,e:=os.CreateTemp(s.path,".metadata-*.json");if e!=nil{return e}
 defer os.Remove(tmp.Name());defer tmp.Close()
 if _,e=tmp.Write(data);e!=nil{return e}
 if e=tmp.Sync();e!=nil{return e}
 if e=tmp.Close();e!=nil{return e}
 return os.Rename(tmp.Name(),filepath.Join(s.path,"manifest.json"))
}
