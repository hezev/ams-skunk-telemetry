using System.IO.MemoryMappedFiles;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace AMSSkunkTelemetry.Desktop;

/// <summary>Direct Assetto Corsa shared memory; raw snapshots are retained for forensic/full-channel export.</summary>
internal sealed class AssettoCorsaAdapter : ISimulatorAdapter
{
    private const string Physics = @"Local\acpmf_physics";
    private int lastTick = -1;
    public string Name => "Assetto Corsa";

    private static byte[]? Read(string mapping, int length)
    {
        try
        {
            using var mmf = MemoryMappedFile.OpenExisting(mapping, MemoryMappedFileRights.Read);
            using var view = mmf.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            var result = new byte[Math.Min(length, (int)Math.Min(view.Capacity, int.MaxValue))];
            if (result.Length == 0) return null;
            view.ReadArray(0, result, 0, result.Length);
            return result;
        }
        catch (FileNotFoundException) { return null; }
        catch (IOException) { return null; }
        catch (UnauthorizedAccessException) { return null; }
    }
    private static double F(byte[] b, int pos) => pos+4<=b.Length ? BitConverter.ToSingle(b,pos) : double.NaN;
    private static int I(byte[] b, int pos) => pos+4<=b.Length ? BitConverter.ToInt32(b,pos) : 0;
    private static string U(byte[]? b, int start, int chars)
    {
        if(b is null || b.Length < start+chars*2)return "";
        return Encoding.Unicode.GetString(b,start,chars*2).Split('\0')[0].Trim();
    }
    public bool TryRead(out SimSnapshot? snapshot)
    {
        snapshot=null;
        var physics=Read(Physics,2048);
        if(physics is null || physics.Length<288){lastTick=-1;return false;}
        int tick=I(physics,0);
        if(tick==lastTick)return false;
        lastTick=tick;
        var graphics=Read(@"Local\acpmf_graphics",1024);
        var staticBlock=Read(@"Local\acpmf_static",1024);
        string car=U(staticBlock,68,33),track=U(staticBlock,134,33);
        var data=new Dictionary<string,object?>
        {
            ["packetId"]=tick,
            ["SpeedKph"]=F(physics,28),
            ["RPM"]=I(physics,20),
            ["Gear"]=I(physics,16)-1,
            ["Throttle"]=F(physics,4)*100,
            ["Brake"]=F(physics,8)*100,
            ["SteerDeg"]=F(physics,24)*180/Math.PI,
            ["FuelLitres"]=F(physics,12),
            ["LatG"]=F(physics,44),
            ["LongG"]=F(physics,52),
            ["TyreFL"]=F(physics,152),["TyreFR"]=F(physics,156),
            ["TyreRL"]=F(physics,160),["TyreRR"]=F(physics,164),
            ["PressureFL"]=F(physics,88)*6.89475729,
            ["PressureFR"]=F(physics,92)*6.89475729,
            ["PressureRL"]=F(physics,96)*6.89475729,
            ["PressureRR"]=F(physics,100)*6.89475729,
            ["RawPhysics"]=Convert.ToBase64String(physics)
        };
        if(graphics is {Length:>=252})
        {
            data["Lap"]=I(graphics,132)+1;
            data["PositionOverall"]=I(graphics,136);
            data["CurrentLapTimeMs"]=I(graphics,140);
            data["LastLapTimeMs"]=I(graphics,144);
            data["LapDistPct"]=F(graphics,248);
            data["RawGraphics"]=Convert.ToBase64String(graphics);
        }
        if(staticBlock is {Length:>=464})
        {
            data["AirTemp"]=F(staticBlock,456);
            data["TrackTemp"]=F(staticBlock,460);
            data["RawStatic"]=Convert.ToBase64String(staticBlock);
        }
        snapshot=new SimSnapshot(Name,track,car,"ac-local",tick,DateTimeOffset.UtcNow,
            "Assetto Corsa shared memory", data,[]);
        return true;
    }
    public void Dispose(){}
}

/// <summary>F1 24/25 UDP 20777. Records every packet type; player telemetry packet 6 also maps to live channels.</summary>
internal sealed class F1UdpAdapter : ISimulatorAdapter
{
    private UdpClient? socket;
    private int tick;
    public string Name=>"F1 24/25";
    public bool TryRead(out SimSnapshot? snapshot)
    {
        snapshot=null;
        try
        {
            socket ??= new UdpClient(new IPEndPoint(IPAddress.Loopback,20777));
            if(socket.Available<=0)return false;
            IPEndPoint endpoint=new(IPAddress.Any,0);
            byte[] b=socket.Receive(ref endpoint);
            if(!IPAddress.IsLoopback(endpoint.Address)||b.Length<29)return false;
            int year=BitConverter.ToUInt16(b,0);
            if(year is not (2024 or 2025))return false;
            int packetId=b[6];
            var data=new Dictionary<string,object?> {
                ["PacketId"]=packetId,["PacketFormat"]=year,
                ["RawPacket"]=Convert.ToBase64String(b)
            };
            if(packetId==6 && b.Length>=29+22*60)
            {
                int player=b[27];
                if(player>=22)return false;
                int pos=29+60*player;
                data["SpeedKph"]=BitConverter.ToUInt16(b,pos);
                data["RPM"]=BitConverter.ToUInt16(b,pos+16);
                data["Gear"]=(int)(sbyte)b[pos+15];
                data["Throttle"]=BitConverter.ToSingle(b,pos+2)*100;
                data["Brake"]=BitConverter.ToSingle(b,pos+10)*100;
                data["SteerInput"]=BitConverter.ToSingle(b,pos+6);
                data["DRS"]=b[pos+18]==1;
                data["TyreFL"]=(int)b[pos+32];data["TyreFR"]=(int)b[pos+33];
                data["TyreRL"]=(int)b[pos+30];data["TyreRR"]=(int)b[pos+31];
                data["PressureFL"]=BitConverter.ToSingle(b,pos+48)*6.89475729;
                data["PressureFR"]=BitConverter.ToSingle(b,pos+52)*6.89475729;
                data["PressureRL"]=BitConverter.ToSingle(b,pos+40)*6.89475729;
                data["PressureRR"]=BitConverter.ToSingle(b,pos+44)*6.89475729;
            }
            snapshot=new SimSnapshot(Name,"F1 Track","F1 Car","f1-udp-local",++tick,
                DateTimeOffset.UtcNow,"F1 UDP data 2024/2025",data,[]);
            return true;
        }
        catch(SocketException) {return false;}
        catch(ObjectDisposedException){return false;}
    }
    public void Dispose()=>socket?.Dispose();
}
