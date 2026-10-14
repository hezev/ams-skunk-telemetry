package garagecapture

import (
 "context"
 "encoding/binary"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)
const sampleYAML="WeekendInfo:\n  TrackDisplayName: Sebring International Raceway\nCarSetup:\n  Tires:\n    LeftFront:\n      ColdPressure: \"160 kPa\"\n      LastHotPressure: 174 kPa\n    RightFront:\n      ColdPressure: \"160 kPa\"\n  Chassis:\n    Front:\n      ArbSize: \"3\"\n  Brake:\n    BrakeBias: \"54.0 %\"\nWeekendOptions:\n  IsFixedSetup: 0\n"
func sharedMemory(yaml string)[]byte{
 b:=make([]byte,48+len(yaml))
 binary.LittleEndian.PutUint32(b[4:],1)
 binary.LittleEndian.PutUint32(b[12:],9)
 binary.LittleEndian.PutUint32(b[16:],uint32(len(yaml)))
 binary.LittleEndian.PutUint32(b[20:],48)
 copy(b[48:],yaml);return b
}
func TestParseSDKSessionInfo(t *testing.T){
 update,text,e:=ReadSessionInfo(sharedMemory(sampleYAML))
 if e!=nil||update!=9{t.Fatalf("bad header %d %v",update,e)}
 p,e:=ParseCarSetup(text);if e!=nil{t.Fatal(e)}
 tires:=p["Tires"].(map[string]any)
 left:=tires["LeftFront"].(map[string]any)
 if left["ColdPressure"]!="160 kPa"{t.Errorf("lost original units: %#v",left)}
 if _,bad:=p["WeekendOptions"];bad{t.Fatal("leaked unrelated SessionInfo section")}
}
func TestRejectMalformedAndUnsupported(t *testing.T){
 bad:=sharedMemory(sampleYAML)
 binary.LittleEndian.PutUint32(bad[20:],999999)
 if _,_,e:=ReadSessionInfo(bad);e==nil{t.Fatal("bad bounds accepted")}
 for _,content:=range []string{
  "WeekendInfo:\n  TrackDisplayName: Sebring",
  "CarSetup:\n  Bad: [1, 2]",
  "CarSetup:\n  Tires:\n    - Front: 32",
  "CarSetup:\n  Wing: 1\n  Wing: 2",
  "CarSetup:\n  Empty:\n",
 }{if _,e:=ParseCarSetup(content);e==nil{t.Errorf("invalid YAML accepted: %s",content)}}
}
func TestCaptureIdempotenceAndRetry(t *testing.T){
 o:=NewObserver();now:=time.Now()
 a,yes,e:=o.Observe(sharedMemory(sampleYAML),"Sebring","Porsche 911","session-1",now)
 if e!=nil||!yes{t.Fatal(e,yes)}
 _,yes,e=o.Observe(sharedMemory(sampleYAML),"Sebring","Porsche 911","session-1",now.Add(time.Second))
 if e!=nil||yes{t.Fatal("duplicate upload attempt",e)}
 // Network failure permits a later retry, with the same stable UUID.
 b,yes,e:=o.Observe(sharedMemory(sampleYAML),"Sebring","Porsche 911","session-1",now.Add(31*time.Second))
 if e!=nil||!yes||a.ID!=b.ID{t.Fatal("retry isn't idempotent",e)}
 o.MarkUploaded(a.ID)
 _,yes,e=o.Observe(sharedMemory(sampleYAML),"Sebring","Porsche 911","session-1",now.Add(time.Hour))
 if e!=nil||yes{t.Fatal("already uploaded capture scheduled again",e)}
 c,e:=NewCapture(sampleYAML,"Sebring","Porsche 911","session-2",now)
 if e!=nil||c.ID==a.ID{t.Fatal("session isolation broken",e)}
}
func TestAuthenticatedHTTPSUpload(t *testing.T){
 now:=time.Now()
 capture,e:=NewCapture(sampleYAML,"Sebring","Porsche 911","session-1",now)
 if e!=nil{t.Fatal(e)}
 called:=false
 srv:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  called=true
  if r.Method!="POST"||r.URL.Path!="/rest/v1/ams_setup_snapshots"{t.Error("wrong route")}
  if r.Header.Get("Authorization")!="Bearer pilot-token"{t.Error("missing pilot bearer")}
  if !strings.Contains(r.Header.Get("Prefer"),"ignore-duplicates"){t.Error("missing idempotency preference")}
  var data map[string]any
  if e:=json.NewDecoder(r.Body).Decode(&data);e!=nil{t.Error(e)}
  if data["client_capture_id"]!=capture.ID||data["source"]!="irsdk_session_info"||data["session_id"]!="session-1"{t.Errorf("bad capture payload: %#v",data)}
  w.WriteHeader(http.StatusNoContent)
 }))
 defer srv.Close()
 u:=Uploader{Endpoint:srv.URL,PublishableKey:"sb_publishable_test",HTTP:srv.Client()}
 if e:=u.Upload(context.Background(),"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","pilot-token",capture);e!=nil{t.Fatal(e)}
 if !called{t.Fatal("network call absent")}
 if e:=u.Upload(context.Background(),"","pilot-token",capture);e==nil{t.Fatal("anonymous upload accepted")}
 u.Endpoint="http://example.invalid"
 if e:=u.Upload(context.Background(),"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","pilot-token",capture);e==nil{t.Fatal("HTTP endpoint accepted")}
}
