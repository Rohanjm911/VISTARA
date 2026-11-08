using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Xunit;

namespace Vistara.UnitTests.Playback;

public class PlaybackLogicTests
{
    [Fact]
    public void PlaybackPercentage_CalculatesCorrectly()
    {
        double position = 1800; // 30 minutes
        double duration = 3600; // 60 minutes

        double percentage = Math.Round((position / duration) * 100, 1);
        Assert.Equal(50.0, percentage);
    }

    [Theory]
    [InlineData(5400, 6000, 90.0, true)]   // 90% watched -> Completed
    [InlineData(5700, 6000, 95.0, true)]   // 95% watched -> Completed
    [InlineData(3000, 6000, 50.0, false)]  // 50% watched -> Not completed
    public void CompletionThreshold_MarksWatchedCorrectly(double pos, double dur, double expectedPct, bool expectedCompleted)
    {
        double percentage = Math.Round((pos / dur) * 100, 1);
        bool isCompleted = percentage >= 90.0;

        Assert.Equal(expectedPct, percentage);
        Assert.Equal(expectedCompleted, isCompleted);
    }
}

