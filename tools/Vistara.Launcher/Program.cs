using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Windows.Forms;

namespace Vistara.Launcher;

static class Program
{
    private const string HealthUrl = "http://127.0.0.1:5178/api/v1/system/ping";
    private const string WebUrl = "http://127.0.0.1:5178/";

    [STAThread]
    static void Main()
    {
        Process? backendProcess = null;

        try
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. Check if backend is already running on port 5178
            bool backendReady = IsBackendRunning();

            if (!backendReady)
            {
                // Prefer native GUI subsystem Vistara.Api.exe first so NO console/cmd/conhost window ever exists
                string[] serverCandidates = new[]
                {
                    Path.Combine(baseDir, "dist", "Vistara-v1.0.0-win-x64", "server", "Vistara.Api.exe"),
                    Path.Combine(baseDir, "server", "Vistara.Api.exe"),
                    Path.Combine(baseDir, "src", "backend", "Vistara.Api", "bin", "Release", "net8.0-windows", "Vistara.Api.exe"),
                    Path.Combine(baseDir, "dist", "Vistara-v1.0.0-win-x64", "server", "Vistara.Api.dll"),
                    Path.Combine(baseDir, "server", "Vistara.Api.dll"),
                    Path.Combine(baseDir, "src", "backend", "Vistara.Api", "bin", "Release", "net8.0-windows", "Vistara.Api.dll"),
                };

                string? serverPath = null;
                foreach (var candidate in serverCandidates)
                {
                    if (File.Exists(candidate))
                    {
                        serverPath = candidate;
                        break;
                    }
                }

                if (serverPath != null)
                {
                    var psi = new ProcessStartInfo();
                    if (serverPath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
                    {
                        psi.FileName = "dotnet";
                        psi.Arguments = $"\"{serverPath}\" --urls \"http://127.0.0.1:5178\"";
                    }
                    else
                    {
                        psi.FileName = serverPath;
                        psi.Arguments = "--urls \"http://127.0.0.1:5178\"";
                    }

                    psi.WorkingDirectory = Path.GetDirectoryName(serverPath);
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;

                    backendProcess = Process.Start(psi);

                    // Wait up to 15 seconds for backend to become responsive
                    for (int i = 0; i < 30; i++)
                    {
                        Thread.Sleep(500);
                        if (IsBackendRunning())
                        {
                            backendReady = true;
                            break;
                        }
                    }
                }
            }

            // 2. Launch Desktop WPF Client
            string[] desktopCandidates = new[]
            {
                Path.Combine(baseDir, "dist", "Vistara-v1.0.0-win-x64", "desktop", "Vistara.Desktop.exe"),
                Path.Combine(baseDir, "desktop", "Vistara.Desktop.exe"),
                Path.Combine(baseDir, "src", "desktop", "Vistara.Desktop", "bin", "Release", "net8.0-windows", "Vistara.Desktop.exe"),
            };

            string? desktopPath = null;
            foreach (var candidate in desktopCandidates)
            {
                if (File.Exists(candidate))
                {
                    desktopPath = candidate;
                    break;
                }
            }

            if (desktopPath != null)
            {
                var desktopPsi = new ProcessStartInfo
                {
                    FileName = desktopPath,
                    WorkingDirectory = Path.GetDirectoryName(desktopPath),
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                var desktopProcess = Process.Start(desktopPsi);

                // Wait for desktop client to close; then cleanly terminate any backend started by launcher
                if (desktopProcess != null)
                {
                    desktopProcess.WaitForExit();

                    if (backendProcess != null && !backendProcess.HasExited)
                    {
                        try
                        {
                            backendProcess.Kill(entireProcessTree: true);
                            backendProcess.Dispose();
                        }
                        catch { }
                    }
                }
            }
            else
            {
                // Fallback: Open in default browser
                Process.Start(new ProcessStartInfo
                {
                    FileName = WebUrl,
                    UseShellExecute = true
                });
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to launch VISTARA: {ex.Message}", "VISTARA Launcher Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            if (backendProcess != null && !backendProcess.HasExited)
            {
                try
                {
                    backendProcess.Kill(entireProcessTree: true);
                    backendProcess.Dispose();
                }
                catch { }
            }
        }
    }

    private static bool IsBackendRunning()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(700) };
            var res = client.GetAsync(HealthUrl).GetAwaiter().GetResult();
            return res.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
