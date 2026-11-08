using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Windows;
using WpfApp = System.Windows.Application;

namespace Vistara.Desktop;

public partial class App : WpfApp
{
    private static Mutex? _mutex;
    private static bool _hasMutex = false;
    private Process? _backendProcess;
    private const string MutexName = "Vistara_SingleInstance_Mutex";
    private const string BackendHealthUrl = "http://127.0.0.1:5178/api/v1/system/ping";

    public static void Log(string message)
    {
        try
        {
            var logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Vistara");
            Directory.CreateDirectory(logDir);
            File.AppendAllText(Path.Combine(logDir, "desktop.log"), $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}] {message}\n");
        }
        catch { }
    }

    private async void Application_Startup(object sender, StartupEventArgs e)
    {
        // Prevent WPF from shutting down when awaiting before MainWindow is shown
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            Log($"Unhandled AppDomain exception: {args.ExceptionObject}");
        };
        DispatcherUnhandledException += (s, args) =>
        {
            Log($"Unhandled Dispatcher exception: {args.Exception}");
            args.Handled = true;
        };

        Log("Vistara.Desktop starting up...");

        bool createdNew;
        _mutex = new Mutex(true, MutexName, out createdNew);
        _hasMutex = createdNew;

        if (!createdNew)
        {
            Log("Another instance is already running.");
            System.Windows.MessageBox.Show("VISTARA is already running. Check your system tray or taskbar.", "VISTARA", MessageBoxButton.OK, MessageBoxImage.Information);
            Current.Shutdown();
            return;
        }

        // Check if backend is already listening
        Log("Checking backend health...");
        bool backendReady = await CheckBackendHealthAsync();
        if (!backendReady)
        {
            Log("Backend not responding. Starting backend process...");
            StartBackendProcess();
            // Wait up to 15 seconds for backend to become healthy
            for (int i = 0; i < 30; i++)
            {
                await Task.Delay(500);
                if (await CheckBackendHealthAsync())
                {
                    backendReady = true;
                    Log($"Backend healthy after {(i + 1) * 500}ms.");
                    break;
                }
            }
        }
        else
        {
            Log("Backend is already running and healthy.");
        }

        Log("Creating MainWindow...");
        try
        {
            var mainWindow = new MainWindow();
            Current.MainWindow = mainWindow;
            mainWindow.Show();
            Log("MainWindow shown successfully.");
        }
        catch (Exception ex)
        {
            Log($"Failed to create or show MainWindow: {ex}");
            var detail = ex.InnerException != null ? $"{ex.Message} -> {ex.InnerException.Message}" : ex.Message;
            System.Windows.MessageBox.Show($"Failed to initialize VISTARA window: {detail}", "VISTARA Error", MessageBoxButton.OK, MessageBoxImage.Error);
            Current.Shutdown();
        }
    }

    private static async Task<bool> CheckBackendHealthAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            var response = await client.GetAsync(BackendHealthUrl);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void StartBackendProcess()
    {
        try
        {
            var currentDir = AppDomain.CurrentDomain.BaseDirectory;
            var candidates = new[]
            {
                Path.Combine(currentDir, "Vistara.Api.exe"),
                Path.Combine(currentDir, "..", "server", "Vistara.Api.exe"),
                Path.Combine(currentDir, "..", "Vistara.Api", "Vistara.Api.exe"),
                Path.Combine(currentDir, "..", "..", "..", "..", "backend", "Vistara.Api", "bin", "Release", "net8.0", "Vistara.Api.exe"),
                Path.Combine(currentDir, "..", "..", "..", "..", "backend", "Vistara.Api", "bin", "Debug", "net8.0", "Vistara.Api.exe")
            };

            foreach (var candidate in candidates)
            {
                if (File.Exists(candidate))
                {
                    var startInfo = new ProcessStartInfo
                    {
                        FileName = candidate,
                        WorkingDirectory = Path.GetDirectoryName(candidate) ?? currentDir,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    _backendProcess = Process.Start(startInfo);
                    return;
                }
            }
        }
        catch { }
    }

    private void Application_Exit(object sender, ExitEventArgs e)
    {
        try
        {
            if (_backendProcess != null && !_backendProcess.HasExited)
            {
                _backendProcess.Kill(entireProcessTree: true);
                _backendProcess.Dispose();
            }
            else
            {
                // Ensure no background API processes linger after exit
                var apiProcesses = Process.GetProcessesByName("Vistara.Api");
                foreach (var proc in apiProcesses)
                {
                    try
                    {
                        proc.Kill(entireProcessTree: true);
                        proc.Dispose();
                    }
                    catch { }
                }
            }
        }
        catch { }

        try
        {
            if (_hasMutex)
            {
                _mutex?.ReleaseMutex();
                _hasMutex = false;
            }
            _mutex?.Dispose();
        }
        catch { }
    }
}
