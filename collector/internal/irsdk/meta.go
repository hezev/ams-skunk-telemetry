package irsdk

import("strings";"strconv")
type Context struct{
 Simulator string `json:"simulator"`
 Track string `json:"track,omitempty"`
 Layout string `json:"layout,omitempty"`
 TrackID string `json:"trackId,omitempty"`
 Car string `json:"car,omitempty"`
 CarID string `json:"carId,omitempty"`
 Driver string `json:"driver,omitempty"`
 SubSessionID string `json:"subSessionId,omitempty"`
 SessionID string `json:"sessionId,omitempty"`
 SessionNum int `json:"sessionNum"`
}
func scalar(s string)string{
 s=strings.TrimSpace(s)
 if p:=strings.Index(s," #");p>=0{s=s[:p]}
 return strings.Trim(strings.TrimSpace(s), "\"'")
}
func ParseContext(info string,sessionNum int)Context{
 c:=Context{Simulator:"iRacing",SessionNum:sessionNum}
 section:="";insideDrivers:=false;driverIdx,target:=-1,-1
 drivers:=map[int]map[string]string{}
 for _,line:=range strings.Split(strings.ReplaceAll(info,"\r\n","\n"),"\n"){
  s:=strings.TrimSpace(line)
  if s==""||strings.HasPrefix(s,"#"){continue}
  if !strings.HasPrefix(line," ")&&strings.HasSuffix(s,":"){section=strings.TrimSuffix(s,":");insideDrivers=false;continue}
  parts:=strings.SplitN(s,":",2);if len(parts)!=2{continue}
  key,value:=parts[0],scalar(parts[1])
  switch section{
  case "WeekendInfo":
   switch key{
   case "TrackDisplayName":c.Track=value
   case "TrackConfigName":c.Layout=value
   case "TrackID":c.TrackID=value
   case "SessionID":c.SessionID=value
   case "SubSessionID":c.SubSessionID=value
   case "TrackName":if c.Track==""{c.Track=value}
   }
  case "DriverInfo":
   if key=="DriverCarIdx"{target,_=strconv.Atoi(value)}
   if key=="Drivers"{insideDrivers=true;continue}
   if insideDrivers&&key=="- CarIdx"{driverIdx,_=strconv.Atoi(value);if drivers[driverIdx]==nil{drivers[driverIdx]=map[string]string{}};continue}
   if insideDrivers&&driverIdx>=0&&len(value)<256{drivers[driverIdx][key]=value}
  }
 }
 if driver:=drivers[target];driver!=nil{
  c.Car=driver["CarScreenName"]
  if c.Car==""{c.Car=driver["CarScreenNameShort"]}
  if c.Car==""{c.Car=driver["CarPath"]}
  c.CarID=driver["CarID"];c.Driver=driver["UserName"]
 }
 return c
}
