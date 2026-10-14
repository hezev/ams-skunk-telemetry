package garagecapture

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "net/url"
 "strings"
 "time"
)
// Uploader writes exclusively using the existing pilot's access token.
// NEVER use a service_role secret in a native client.
type Uploader struct{Endpoint,PublishableKey string;HTTP *http.Client}
func(u Uploader)Upload(ctx context.Context,pilotID,accessToken string,c Capture)error{
 if !validUUID(pilotID)||accessToken==""||u.PublishableKey==""{return errors.New("sessão AMS do piloto não autenticada")}
 uri,e:=url.Parse(u.Endpoint);if e!=nil||uri.Scheme!="https"||uri.Host==""||uri.User!=nil{return errors.New("endpoint HTTPS inválido")}
 if c.Track==""||c.Car==""||c.SessionID==""||!validUUID(c.ID)||len(c.Parameters)==0{return errors.New("CarSetup incompleto")}
 data,e:=json.Marshal(map[string]any{
  "pilot_id":pilotID,"client_capture_id":c.ID,"simulator":"iRacing","circuit":c.Track,
  "car":c.Car,"session_id":c.SessionID,"source":"irsdk_session_info",
  "car_setup":c.Parameters,"captured_at":c.CapturedAt.UTC().Format(time.RFC3339Nano),
 });if e!=nil{return e}
 if len(data)>255000{return errors.New("CarSetup excede o limite seguro")}
 target:=strings.TrimRight(u.Endpoint,"/")+"/rest/v1/ams_setup_snapshots?on_conflict=pilot_id,client_capture_id"
 req,e:=http.NewRequestWithContext(ctx,"POST",target,bytes.NewReader(data));if e!=nil{return e}
 req.Header.Set("apikey",u.PublishableKey)
 req.Header.Set("Authorization","Bearer "+accessToken)
 req.Header.Set("Content-Type","application/json")
 req.Header.Set("Prefer","resolution=ignore-duplicates,return=minimal")
 client:=u.HTTP;if client==nil{client=&http.Client{Timeout:20*time.Second}}
 resp,e:=client.Do(req);if e!=nil{return fmt.Errorf("falha de comunicação do snapshot: %w",e)}
 defer resp.Body.Close()
 if resp.StatusCode!=200&&resp.StatusCode!=201&&resp.StatusCode!=204{
  msg,_:=io.ReadAll(io.LimitReader(resp.Body,160))
  return fmt.Errorf("Supabase rejeitou snapshot: HTTP %d (%s)",resp.StatusCode,strings.TrimSpace(string(msg)))
 }
 return nil
}
func validUUID(s string)bool{
 if len(s)!=36{return false}
 for i,c:=range s{
  if i==8||i==13||i==18||i==23{if c!='-'{return false};continue}
  if !((c>='0'&&c<='9')||(c>='a'&&c<='f')||(c>='A'&&c<='F')){return false}
 }
 return true
}
