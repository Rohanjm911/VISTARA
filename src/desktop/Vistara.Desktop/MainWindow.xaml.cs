using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows;
using System.Windows.Forms;
using System.Windows.Input;
using MessageBox = System.Windows.MessageBox;

namespace Vistara.Desktop;

public partial class MainWindow : Window
{
    private NotifyIcon? _trayIcon;
    private bool _isFullscreen = false;
    private WindowState _previousWindowState;
    private const string AppUrl = "http://127.0.0.1:5178/";

    public MainWindow()
    {
        InitializeComponent();
        InitializeSystemTray();
        InitializeWebViewAsync();

        KeyDown += MainWindow_KeyDown;
    }

    private async void InitializeWebViewAsync()
    {
        try
        {
            App.Log("Initializing WebView2 environment...");
            var appDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Vistara", "webview_data");
            Directory.CreateDirectory(appDataDir);

            var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions
            {
                AdditionalBrowserArguments = "--autoplay-policy=no-user-gesture-required"
            };
            var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, appDataDir, options);
            await MainWebView.EnsureCoreWebView2Async(env);

            MainWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            MainWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            MainWebView.CoreWebView2.Settings.IsZoomControlEnabled = true;

            // HTML5 Fullscreen Support inside WebView2
            MainWebView.CoreWebView2.ContainsFullScreenElementChanged += (s, e) =>
            {
                Dispatcher.Invoke(() =>
                {
                    SetFullscreen(MainWebView.CoreWebView2.ContainsFullScreenElement);
                });
            };

            // PostMessage bridge for media player fullscreen commands
            MainWebView.CoreWebView2.WebMessageReceived += (s, e) =>
            {
                try
                {
                    var msg = e.TryGetWebMessageAsString();
                    if (msg == "toggle_fullscreen")
                    {
                        Dispatcher.Invoke(() => ToggleFullscreen());
                    }
                }
                catch { }
            };

            MainWebView.NavigationCompleted += (s, e) =>
            {
                if (e.IsSuccess)
                {
                    App.Log("WebView2 navigation succeeded.");
                    Dispatcher.Invoke(() =>
                    {
                        SplashOverlay.Visibility = Visibility.Collapsed;
                    });
                }
                else
                {
                    App.Log($"WebView2 navigation failed (Status: {e.WebErrorStatus}). Retrying in 1.5s...");
                    Task.Delay(1500).ContinueWith(_ =>
                    {
                        Dispatcher.Invoke(() =>
                        {
                            MainWebView.CoreWebView2?.Navigate(AppUrl);
                        });
                    });
                }
            };

            App.Log($"Navigating WebView2 to {AppUrl}...");
            MainWebView.CoreWebView2.Navigate(AppUrl);
        }
        catch (Exception ex)
        {
            App.Log($"WebView2 initialization failed: {ex}");
            MessageBox.Show($"Failed to initialize WebView2: {ex.Message}\n\nPlease ensure Microsoft Edge WebView2 Runtime is installed.", "VISTARA Desktop Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void InitializeSystemTray()
    {
        Icon trayIconGraphic = SystemIcons.Application;
        var iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.ico");
        if (File.Exists(iconPath))
        {
            try { trayIconGraphic = new Icon(iconPath); } catch { }
        }

        _trayIcon = new NotifyIcon
        {
            Text = "VISTARA — Personal Media Universe",
            Visible = true,
            Icon = trayIconGraphic
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add("Open VISTARA", null, (_, _) => RestoreWindow());
        menu.Items.Add("Open in Browser", null, (_, _) => OpenInBrowser());
        menu.Items.Add("-");
        menu.Items.Add("Exit", null, (_, _) =>
        {
            _trayIcon.Visible = false;
            System.Windows.Application.Current.Shutdown();
        });

        _trayIcon.ContextMenuStrip = menu;
        _trayIcon.DoubleClick += (_, _) => RestoreWindow();
    }

    private void RestoreWindow()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void OpenInBrowser()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = AppUrl,
                UseShellExecute = true
            });
        }
        catch { }
    }

    private void TitleBar_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            if (e.ClickCount == 2)
            {
                Maximize_Click(sender, e);
            }
            else
            {
                DragMove();
            }
        }
    }

    private void Minimize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void Maximize_Click(object sender, RoutedEventArgs e)
    {
        if (WindowState == WindowState.Maximized)
        {
            WindowState = WindowState.Normal;
            TxtMaximize.Text = "□";
        }
        else
        {
            WindowState = WindowState.Maximized;
            TxtMaximize.Text = "❐";
        }
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        // Minimize to tray on close
        Hide();
        _trayIcon?.ShowBalloonTip(2000, "VISTARA", "Running in background in the system tray.", ToolTipIcon.Info);
    }

    private void Fullscreen_Click(object sender, RoutedEventArgs e)
    {
        ToggleFullscreen();
    }

    private void OpenInBrowser_Click(object sender, RoutedEventArgs e)
    {
        OpenInBrowser();
    }

    private void MainWindow_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == Key.F11)
        {
            ToggleFullscreen();
        }
        else if (e.Key == Key.Escape && _isFullscreen)
        {
            SetFullscreen(false);
        }
        else if (e.Key == Key.F5 || (e.Key == Key.R && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control))
        {
            MainWebView.CoreWebView2?.Reload();
        }
    }

    private void ToggleFullscreen()
    {
        SetFullscreen(!_isFullscreen);
    }

    private void SetFullscreen(bool enable)
    {
        if (enable)
        {
            if (!_isFullscreen)
            {
                _previousWindowState = WindowState;
            }
            TitleBarRow.Height = new GridLength(0);
            TitleBarBorder.Visibility = Visibility.Collapsed;
            WindowState = WindowState.Normal;
            WindowStyle = WindowStyle.None;
            WindowState = WindowState.Maximized;
            _isFullscreen = true;
        }
        else
        {
            TitleBarRow.Height = new GridLength(38);
            TitleBarBorder.Visibility = Visibility.Visible;
            WindowState = _previousWindowState;
            _isFullscreen = false;
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        if (_trayIcon != null)
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
        }
        base.OnClosed(e);
    }
}

