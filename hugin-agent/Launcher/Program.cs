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
    return Install(installDir, launcherExe, agentExe);

var sourceDir = Path.GetDirectoryName(launcherExe);
var siblingAgent = sourceDir is null ? null : Path.Combine(sourceDir, "HizliSatis.HuginAgent.exe");
if (!File.Exists(agentExe) && siblingAgent is not null && File.Exists(siblingAgent))
    return Install(installDir, launcherExe, agentExe);

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

static int Install(string installDir, string launcherExe, string agentExe)
{
    var targetLauncher = Path.Combine(installDir, "HizliSatis.AgentLauncher.exe");
    var sourceDir = Path.GetDirectoryName(launcherExe);
    var siblingAgent = sourceDir is null ? null : Path.Combine(sourceDir, "HizliSatis.HuginAgent.exe");
    StopRunningAgent();
    try
    {
        if (siblingAgent is not null &&
            File.Exists(siblingAgent) &&
            !string.Equals(Path.GetFullPath(siblingAgent), Path.GetFullPath(agentExe), StringComparison.OrdinalIgnoreCase))
            File.Copy(siblingAgent, agentExe, overwrite: true);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Yeni ajan kopyalanamadı. Eski ajan hâlâ açıksa görev yöneticisinden kapatıp Kur'a tekrar bas.");
        Console.WriteLine(ex.Message);
        return 1;
    }

    try
    {
        if (!string.Equals(Path.GetFullPath(launcherExe), Path.GetFullPath(targetLauncher), StringComparison.OrdinalIgnoreCase))
            File.Copy(launcherExe, targetLauncher, overwrite: true);
    }
    catch { /* ignore */ }

    if (!File.Exists(agentExe))
    {
        Console.WriteLine("Ajan dosyası bulunamadı. Kur ile aynı klasörde HizliSatis.HuginAgent.exe olmalı.");
        return 1;
    }

    RegisterProtocol(targetLauncher);
    RegisterStartup(targetLauncher);
    if (IsPortOpen(5055))
        StopRunningAgent();
    if (!IsPortOpen(5055))
        StartAgentHidden(agentExe);
    else
    {
        Console.WriteLine("5055 hâlâ dolu. Eski ajan kapanmadı, fiş basımı çalışmaz.");
        return 1;
    }
    Console.WriteLine("Kurulum tamam. Ajan gizli başlatıldı ve Windows açılışında otomatik gelecek.");
    return 0;
}

static void StopRunningAgent()
{
    foreach (var proc in Process.GetProcessesByName("HizliSatis.HuginAgent"))
    {
        try
        {
            if (!proc.HasExited)
            {
                proc.Kill(entireProcessTree: true);
                proc.WaitForExit(5000);
            }
        }
        catch
        {
            /* kilitli süreç kopyayı da kilitleyebilir */
        }
        finally
        {
            proc.Dispose();
        }
    }

    for (var i = 0; i < 25 && IsPortOpen(5055); i++)
        Thread.Sleep(200);
}

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
