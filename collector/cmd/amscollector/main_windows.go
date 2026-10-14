//go:build windows
package main
import(
 "encoding/binary"
 "errors"
 "flag"
 "fmt"
 "log"
 "os"
 "os/signal"
 "path/filepath"
 "syscall"
 "time"
 "unsafe"
 "github.com/hezev/ams-skunk-telemetry/collector/internal/archive"
 "github.com/hezev/ams-skunk-telemetry/collector/internal/irsdk"
)
var kernel32=syscall.NewLazyDLL("kernel32.dll")
var openMapping=kernel32.NewProc("OpenFileMappingW")
var mapView=kernel32.NewProc("MapViewOfFile")
var unmapView=kernel32.NewProc("UnmapViewOfFile")
var closeHandle=kernel32.NewProc("CloseHandle")
var virtualQuery=kernel32.NewProc("VirtualQuery")
const mappingName="Local\\IRSDKMemMapFileName"
func memorySnapshot()([]byte,error){
 n,_:=syscall.UTF16PtrFromString(mappingName)
 h,_,_:=openMapping.Call(0x0004,0,uintptr(unsafe.Pointer(n)))
 if h==0{return nil,errors.New("iRacing ainda não está ligado")}
 defer closeHandle.Call(h)
 p,_,_:=mapView.Call(h,0x0004,0,0,0)
 if p==0{return nil,errors.New("iRacing SDK mapping unavailable")}
 defer unmapView.Call(p)
 var mbi [48]byte
 size,_,_:=virtualQuery.Call(p,uintptr(unsafe.Pointer(&mbi[0])),uintptr(len(mbi)))
 if size==0{return nil,errors.New("cannot query mapping size")}
 region:=*(*uintptr)(unsafe.Pointer(&mbi[24]))
 if region<112{return nil,errors.New("mapping too small")}
 limit:=region;if limit>4*1024*1024{limit=4*1024*1024}
 data:=make([]byte,int(limit))
 copy(data,unsafe.Slice((*byte)(unsafe.Pointer(p)),int(limit)))
 if len(data)<112||binary.LittleEndian.Uint32(data[4:8])&1==0{return nil,irsdk.ErrDisconnected}
 return data,nil
}
func run(root string)error{
 ticker:=time.NewTicker(time.Second/60);defer ticker.Stop()
 sig:=make(chan os.Signal,1);signal.Notify(sig,os.Interrupt,syscall.SIGTERM);defer signal.Stop(sig)
 var writer *archive.Store
 var key string;var lastTick int32=-1;var total int;var lastUpdate uint32
 lastStatus:=time.Now().Add(-time.Hour)
 for{
  select{case <-sig:if writer!=nil{return writer.Flush()};return nil;case <-ticker.C:}
  at:=time.Now().UTC()
  raw,e:=memorySnapshot()
  if e!=nil{
   if time.Since(lastStatus)>15*time.Second{log.Print("iRacing desconectado/sem sessão; aguardar...");lastStatus=time.Now()}
   if writer!=nil{if err:=writer.Flush();err!=nil{log.Printf("erro ao guardar: %v",err)};writer=nil;key=""}
   continue
  }
  frame,e:=irsdk.Decode(raw)
  if e!=nil{if time.Since(lastStatus)>10*time.Second{log.Printf("SDK: %v",e);lastStatus=time.Now()};continue}
  if frame.Tick==lastTick&&frame.SessionInfoUpdate==lastUpdate{continue}
  lastTick=frame.Tick;lastUpdate=frame.SessionInfoUpdate
  sessionNum:=0;if n,ok:=irsdk.Number(frame.Values["SessionNum"]);ok{sessionNum=int(n)}
  ctx:=irsdk.ParseContext(frame.SessionInfo,sessionNum)
  newKey:=fmt.Sprintf("%s/%s/%s/%s/%d",ctx.Track,ctx.Layout,ctx.Car,ctx.SessionID,ctx.SessionNum)
  if writer==nil||newKey!=key{
   if writer!=nil{if err:=writer.Flush();err!=nil{return err}}
   writer,e=archive.New(root,ctx,at);if e!=nil{return e}
   key=newKey;log.Printf("nova sessão iRacing: pista=%q carro=%q ficheiros=%s",ctx.Track,ctx.Car,writer.Directory())
  }
  if e=writer.Append(frame,at);e!=nil{return e}
  total++
  if time.Since(lastStatus)>10*time.Second{log.Printf("captura ativa: %d ticks; canais=%d; 60 Hz alvo",total,len(frame.Channels));lastStatus=time.Now()}
 }
}
func main(){
 root:=flag.String("output","","pasta para gravação de telemetria bruta");flag.Parse()
 if *root==""{data:=os.Getenv("LOCALAPPDATA");if data==""{data=os.TempDir()};*root=filepath.Join(data,"AMSCollector","sessions")}
 log.Printf("AMS Collector iRacing — offline-first, SEM envio Supabase nesta versão. Pasta: %s",*root)
 if err:=run(*root);err!=nil{log.Fatal(err)}
}
