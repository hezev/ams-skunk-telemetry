// Package irsdk decodes real iRacing shared-memory snapshots, preserving every
// valid channel with its original name, type, count and unit.
package irsdk

import (
 "bytes"
 "encoding/binary"
 "errors"
 "fmt"
 "math"
 "strings"
 "unicode/utf8"
)

var ErrDisconnected=errors.New("iRacing SDK not connected")
var ErrInvalidSnapshot=errors.New("invalid iRacing shared memory snapshot")
const (maxVars=1600; maxSamplesPerChannel=512; maxBufferBytes=2*1024*1024; maxSessionInfo=1024*1024; headerSize=48; varHeaderSize=144)
type Channel struct {
 Name string `json:"name"`
 Type int `json:"type"`
 Count int `json:"count"`
 Unit string `json:"unit,omitempty"`
 Description string `json:"description,omitempty"`
}
type Frame struct {
 Tick int32 `json:"tick"`
 TickRate uint32 `json:"tickRate"`
 SessionInfoUpdate uint32 `json:"sessionInfoUpdate"`
 SessionInfo string `json:"-"`
 Values map[string]any `json:"values"`
 Channels []Channel `json:"channels"`
}
func uint32At(b []byte,i int)uint32{return binary.LittleEndian.Uint32(b[i:i+4])}
func cleanString(b []byte)string{if z:=bytes.IndexByte(b,0);z>=0{b=b[:z]};return strings.TrimSpace(string(b))}
func typeSize(t int)int{switch t{case 0,1:return 1;case 2,3,4:return 4;case 5:return 8};return 0}
func valueAt(b []byte,t int)(any,bool){
 if len(b)<typeSize(t)||typeSize(t)==0{return nil,false}
 switch t{
 case 0:return int(int8(b[0])),true
 case 1:return b[0]!=0,true
 case 2:return int32(binary.LittleEndian.Uint32(b)),true
 case 3:return binary.LittleEndian.Uint32(b),true
 case 4:
  f:=math.Float32frombits(binary.LittleEndian.Uint32(b))
  if math.IsNaN(float64(f))||math.IsInf(float64(f),0){return nil,false}
  return f,true
 case 5:
  f:=math.Float64frombits(binary.LittleEndian.Uint64(b))
  if math.IsNaN(f)||math.IsInf(f,0){return nil,false}
  return f,true
 }
 return nil,false
}
// Decode validates SDK buffers, variable headers, lengths and finite values.
func Decode(b []byte)(Frame,error){
 if len(b)<112{return Frame{},ErrInvalidSnapshot}
 if uint32At(b,4)&1==0{return Frame{},ErrDisconnected}
 nVars,vo,nBuf,bufLen:=int(uint32At(b,24)),int(uint32At(b,28)),int(uint32At(b,32)),int(uint32At(b,36))
 if nVars<1||nVars>maxVars||nBuf<1||nBuf>4||bufLen<1||bufLen>maxBufferBytes||vo<112||vo>len(b)||nVars>(len(b)-vo)/varHeaderSize{return Frame{},ErrInvalidSnapshot}
 bestTick:=int32(-1);row:=-1
 for i:=0;i<nBuf;i++{
  h:=headerSize+i*16
  if h+8>len(b){return Frame{},ErrInvalidSnapshot}
  tick,start:=int32(uint32At(b,h)),int(uint32At(b,h+4))
  if tick>=0&&tick>=bestTick&&start>=112&&start<=len(b)&&bufLen<=len(b)-start{bestTick=tick;row=start}
 }
 if row<0{return Frame{},ErrInvalidSnapshot}
 out:=Frame{Tick:bestTick,TickRate:uint32At(b,8),SessionInfoUpdate:uint32At(b,12),Values:make(map[string]any,nVars),Channels:make([]Channel,0,nVars)}
 if n:=int(uint32At(b,16));n>0&&n<=maxSessionInfo{
  off:=int(uint32At(b,20))
  if off>=112&&off<=len(b)&&n<=len(b)-off{
   data:=bytes.TrimRight(b[off:off+n],"\x00")
   if utf8.Valid(data){out.SessionInfo=string(data)}
  }
 }
 for i:=0;i<nVars;i++{
  off:=vo+i*varHeaderSize
  typ,start,count:=int(uint32At(b,off)),int(uint32At(b,off+4)),int(uint32At(b,off+8))
  sz:=typeSize(typ)
  if sz==0||count<1||count>maxSamplesPerChannel||start<0||start>bufLen||count*sz>bufLen-start{continue}
  name,unit,desc:=cleanString(b[off+16:off+48]),cleanString(b[off+112:off+144]),cleanString(b[off+48:off+112])
  if name==""||len(name)>32||!utf8.ValidString(name){continue}
  data:=b[row+start:row+start+count*sz]
  var val any
  if typ==0&&count>1{
   if !utf8.Valid(data){continue};val=cleanString(data)
  }else if count==1{
   var ok bool;val,ok=valueAt(data,typ);if !ok{continue}
  }else{
   vals:=make([]any,count);ok:=true
   for j:=0;j<count;j++{v,valid:=valueAt(data[j*sz:(j+1)*sz],typ);if !valid{ok=false;break};vals[j]=v}
   if !ok{continue};val=vals
  }
  out.Values[name]=val
  out.Channels=append(out.Channels,Channel{Name:name,Type:typ,Count:count,Unit:unit,Description:desc})
 }
 if len(out.Channels)==0{return Frame{},fmt.Errorf("%w: no valid channels",ErrInvalidSnapshot)}
 return out,nil
}
func Number(v any)(float64,bool){
 switch x:=v.(type){case float32:return float64(x),true;case float64:return x,true;case int:return float64(x),true;case int32:return float64(x),true;case uint32:return float64(x),true}
 return 0,false
}
