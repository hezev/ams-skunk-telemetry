package archive
import(
 "compress/gzip"
 "encoding/json"
 "os"
 "path/filepath"
 "testing"
 "time"
 "github.com/hezev/ams-skunk-telemetry/collector/internal/irsdk"
)
func TestOfflineAtomicChunksAndOriginalValues(t *testing.T){
 root:=t.TempDir()
 ctx:=irsdk.Context{Simulator:"iRacing",Track:"Tsukuba",Car:"Toyota GR86",SessionID:"42"}
 store,e:=New(root,ctx,time.Date(2026,10,14,15,0,0,0,time.UTC));if e!=nil{t.Fatal(e)}
 frame:=irsdk.Frame{TickRate:60,Channels:[]irsdk.Channel{{Name:"Speed",Type:4,Count:1,Unit:"m/s"}},Values:map[string]any{"Speed":float32(43.5)}}
 for i:=0;i<258;i++{
  frame.Tick=int32(100+i);if i==12{frame.Tick=111}
  if e:=store.Append(frame,time.Now());e!=nil{t.Fatal(e)}
 }
 if e:=store.Flush();e!=nil{t.Fatal(e)}
 bytes,e:=os.ReadFile(filepath.Join(store.Directory(),"manifest.json"));if e!=nil{t.Fatal(e)}
 var m Metadata;if e=json.Unmarshal(bytes,&m);e!=nil{t.Fatal(e)}
 if m.SampleCount!=257||m.Chunks!=2||m.Channels[0].Unit!="m/s"{t.Fatalf("manifest lost data %+v",m)}
 file,e:=os.Open(filepath.Join(store.Directory(),"samples-000001.jsonl.gz"));if e!=nil{t.Fatal(e)};defer file.Close()
 zip,e:=gzip.NewReader(file);if e!=nil{t.Fatal(e)};defer zip.Close()
 var s Envelope
 if e=json.NewDecoder(zip).Decode(&s);e!=nil{t.Fatal(e)}
 if s.Tick!=100||s.Values["Speed"]==nil{t.Fatalf("lost raw sample %+v",s)}
}
