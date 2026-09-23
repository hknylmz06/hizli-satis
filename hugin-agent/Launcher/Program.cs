using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using Microsoft.Win32;

// Gizli başlatıcı + protokol kaydı: hizlisatis-agent://start
// Kullanım:
//   HizliSatis.AgentLauncher.exe install
//   HizliSatis.AgentLauncher.exe start
//   HizliSatis.AgentLauncher.exe   (protokol ile de gelir)

var argsList = args.Select(a => a.Trim().Trim('"')).Where(a => a.Length > 0).ToList();
var command = argsList.FirstOrDefault() ?? "start";
if (command.StartsWith("hizlisatis-agent:", StringComparison.OrdinalIgnoreCase))
    command = "start";

var installDir = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "HizliSatisAgent");
Directory.CreateDirectory(installDir);

var agentExe = Path.Combine(installDir, "HizliSatis.HuginAgent.exe");
var launcherExe = Environment.ProcessPath ?? Path.Combine(installDir, "HizliSatis.AgentLauncher.exe");

if (string.Equals(command, "install", StringComparison.OrdinalIgnoreCase))
{
    // Bu launcher'ı install dir'e kopyala
    var targetLauncher = Path.Combine(installDir, "HizliSatis.AgentLauncher.exe");
    try
    {
        if (!string.Equals(launcherExe, targetLauncher, StringComparison.OrdinalIgnoreCase))
            File.Copy(launcherExe, targetLauncher, overwrite: true);
    }
    catch { /* ignore */ }

    // Agent exe yoksa uyarı
    if (!File.Exists(agentExe))
    {
        Console.WriteLine("Önce ajanı publish edin: publish-agent.ps1");
        Console.WriteLine($"Beklenen: {agentExe}");
        return 1;
    }

    RegisterProtocol(targetLauncher);
    RegisterStartup(targetLauncher);
    StartAgentHidden(agentExe);
    Console.WriteLine("Kurulum tamam. Ajan gizli başlatıldı ve Windows açılışında otomatik gelecek.");
    return 0;
}

// start
if (!File.Exists(agentExe))
{
    // Geliştirme: proje klasöründeki dll ile çalıştırmayı dene
    var devDll = FindDevAgentDll();
    if (devDll is not null)
    {
        if (!IsPortOpen(5055))
            StartProcessHidden("dotnet", $"\"{devDll}\"", Path.GetDirectoryName(devDll)!);
        return 0;
    }

    return 2;
}

if (!IsPortOpen(5055))
    StartAgentHidden(agentExe);

return 0;

static void RegisterProtocol(string launcherPath)
{
    using var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\hizlisatis-agent");
    key.SetValue("", "URL:HizliSatis Agent");
    key.SetValue("URL Protocol", "");
    using var cmd = key.CreateSubKey(@"shell\open\command");
    cmd.SetValue("", $"\"{launcherPath}\" \"%1\"");
}

static void RegisterStartup(string launcherPath)
{
    using var run = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", writable: true)
                  ?? Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
    run.SetValue("HizliSatisHuginAgent", $"\"{launcherPath}\" start");
}

static void StartAgentHidden(string exePath)
{
    StartProcessHidden(exePath, "", Path.GetDirectoryName(exePath)!);
}

static void StartProcessHidden(string fileName, string arguments, string workingDir)
{
    var psi = new ProcessStartInfo
    {
        FileName = fileName,
        Arguments = arguments,
        WorkingDirectory = workingDir,
        UseShellExecute = false,
        CreateNoWindow = true,
        WindowStyle = ProcessWindowStyle.Hidden
    };
    Process.Start(psi);
}

static bool IsPortOpen(int port)
{
    try
    {
        using var client = new TcpClient();
        var task = client.ConnectAsync(IPAddress.Loopback, port);
        return task.Wait(400) && client.Connected;
    }
    catch
    {
        return false;
    }
}

static string? FindDevAgentDll()
{
    var candidates = new[]
    {
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "bin", "Debug", "net9.0", "HizliSatis.HuginAgent.dll")),
        Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "bin", "Debug", "net9.0", "HizliSatis.HuginAgent.dll")),
        Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "hugin-agent", "bin", "Debug", "net9.0", "HizliSatis.HuginAgent.dll"))
    };
    return candidates.FirstOrDefault(File.Exists);
}
