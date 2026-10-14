package irsdk
import("encoding/binary";"math";"testing")
func mockFrame()[]byte{
 b:=make([]byte,4096)
 binary.LittleEndian.PutUint32(b[4:],1)
 binary.LittleEndian.PutUint32(b[8:],60)
 binary.LittleEndian.PutUint32(b[12:],4)
 binary.LittleEndian.PutUint32(b[24:],4)
 binary.LittleEndian.PutUint32(b[28:],112)
 binary.LittleEndian.PutUint32(b[32:],1)
 binary.LittleEndian.PutUint32(b[36:],256)
 binary.LittleEndian.PutUint32(b[48:],85)
 binary.LittleEndian.PutUint32(b[52:],1024)
 fields:=[]struct{typ,count,start int;name,unit string}{
 {4,1,0,"Speed","m/s"},{4,1,4,"LapDistPct","%"},{2,1,8,"Lap",""},{4,3,16,"CarIdxLapDistPct","%"},
 }
 for i,f:=range fields{
  o:=112+i*144
  binary.LittleEndian.PutUint32(b[o:],uint32(f.typ))
  binary.LittleEndian.PutUint32(b[o+4:],uint32(f.start))
  binary.LittleEndian.PutUint32(b[o+8:],uint32(f.count))
  copy(b[o+16:],f.name);copy(b[o+112:],f.unit)
 }
 binary.LittleEndian.PutUint32(b[1024:],math.Float32bits(55.4))
 binary.LittleEndian.PutUint32(b[1028:],math.Float32bits(.35))
 binary.LittleEndian.PutUint32(b[1032:],3)
 for i,v:=range []float32{.1,.35,.9}{binary.LittleEndian.PutUint32(b[1040+i*4:],math.Float32bits(v))}
 text:="WeekendInfo:\n  TrackDisplayName: Tsukuba Circuit\n  TrackConfigName: 2k Full\n  TrackID: 112\n  SessionID: 47182\nDriverInfo:\n  DriverCarIdx: 1\n  Drivers:\n  - CarIdx: 1\n    CarScreenName: Toyota GR86\n    CarID: 44\n    UserName: Driver Test\n"
 binary.LittleEndian.PutUint32(b[16:],uint32(len(text)))
 binary.LittleEndian.PutUint32(b[20:],2048)
 copy(b[2048:],text)
 return b
}
func TestDecodePreservesOriginalUnitsAndArrays(t *testing.T){
 f,e:=Decode(mockFrame());if e!=nil{t.Fatal(e)}
 if f.Tick!=85||f.TickRate!=60||len(f.Channels)!=4{t.Fatalf("bad metadata: %#v",f)}
 if f.Channels[0].Unit!="m/s"{t.Fatal("original units lost")}
 speed,_:=Number(f.Values["Speed"])
 if math.Abs(speed-55.4)>.001{t.Fatalf("wrong speed %v",speed)}
 values,ok:=f.Values["CarIdxLapDistPct"].([]any)
 if !ok||len(values)!=3{t.Fatal("lost CarIdx array")}
 ctx:=ParseContext(f.SessionInfo,1)
 if ctx.Track!="Tsukuba Circuit"||ctx.Layout!="2k Full"||ctx.Car!="Toyota GR86"||ctx.SessionID!="47182"{t.Fatalf("bad SDK context: %+v",ctx)}
}
func TestRejectInvalidMemoryAndNaN(t *testing.T){
 if _,e:=Decode(make([]byte,40));e==nil{t.Fatal("short memory accepted")}
 b:=mockFrame();binary.LittleEndian.PutUint32(b[4:],0)
 if _,e:=Decode(b);e!=ErrDisconnected{t.Fatal("not disconnected",e)}
 b=mockFrame();binary.LittleEndian.PutUint32(b[28:],4090)
 if _,e:=Decode(b);e==nil{t.Fatal("bad header overflow accepted")}
 b=mockFrame();binary.LittleEndian.PutUint32(b[1024:],math.Float32bits(float32(math.NaN())))
 f,e:=Decode(b);if e!=nil{t.Fatal(e)}
 if _,ok:=f.Values["Speed"];ok{t.Fatal("invalid float invented")}
}
