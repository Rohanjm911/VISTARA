using Microsoft.AspNetCore.SignalR;
using Vistara.Core.DTOs;

namespace Vistara.Api.Hubs;

public interface IVistaraClient
{
    Task ScanProgress(ScanProgressDto progress);
    Task JobUpdated(BackgroundJobDto job);
    Task PlaybackProgressUpdated(PlaybackProgressDto progress);
    Task SystemNotification(string message, string level);
    Task IntegrityScanProgress(IntegrityScanProgressDto progress);
    Task IntegrityIssueDetected(IntegrityFileRecordDto issue);
    Task IntegrityScanCompleted(IntegrityScanDto scan);
}

public class VistaraHub : Hub<IVistaraClient>
{
    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }
}

