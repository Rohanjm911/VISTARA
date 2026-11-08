using System.Text.RegularExpressions;
using Xunit;

namespace Vistara.UnitTests.Parsing;

public class FilenameParserTests
{
    private static readonly Regex SeasonEpisodeRegex = new(
        @"(?:s|season\s*)(\d{1,2})[\s\.]*(?:e|x|episode\s*)(\d{1,3})|(\d{1,2})x(\d{1,3})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex YearRegex = new(
        @"(?:\(|\.|\[|\s)(19\d{2}|20\d{2})(?:\)|\.|\]|\s)",
        RegexOptions.Compiled);

    private static readonly Regex EditionRegex = new(
        @"(director'?s[\s\.]*cut|extended(?:[\s\.]*cut)?|theatrical(?:[\s\.]*version)?|unrated|remastered|special[\s\.]*edition|imax)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [Theory]
    [InlineData("Breaking.Bad.S02E07.mkv", 2, 7)]
    [InlineData("Game of Thrones - 1x04 - Cripples, Bastards, and Broken Things.mp4", 1, 4)]
    [InlineData("Stranger.Things.Season 3 Episode 08.mkv", 3, 8)]
    [InlineData("The.Office.S05E28.Company.Picnic.1080p.mkv", 5, 28)]
    public void SeasonEpisodeRegex_MatchesCorrectly(string filename, int expectedSeason, int expectedEpisode)
    {
        var match = SeasonEpisodeRegex.Match(filename);
        Assert.True(match.Success);

        int season = 0;
        int episode = 0;

        if (!string.IsNullOrEmpty(match.Groups[1].Value))
            season = int.Parse(match.Groups[1].Value);
        else if (!string.IsNullOrEmpty(match.Groups[3].Value))
            season = int.Parse(match.Groups[3].Value);

        if (!string.IsNullOrEmpty(match.Groups[2].Value))
            episode = int.Parse(match.Groups[2].Value);
        else if (!string.IsNullOrEmpty(match.Groups[4].Value))
            episode = int.Parse(match.Groups[4].Value);

        Assert.Equal(expectedSeason, season);
        Assert.Equal(expectedEpisode, episode);
    }

    [Theory]
    [InlineData("Inception (2010).mp4", 2010)]
    [InlineData("The.Matrix.1999.Remastered.1080p.mkv", 1999)]
    [InlineData("Interstellar [2014] IMAX.mkv", 2014)]
    public void YearRegex_ExtractsYearCorrectly(string filename, int expectedYear)
    {
        var match = YearRegex.Match(filename);
        Assert.True(match.Success);
        Assert.Equal(expectedYear, int.Parse(match.Groups[1].Value));
    }

    [Theory]
    [InlineData("Blade.Runner.Directors.Cut.1080p.mkv", true)]
    [InlineData("Lord.of.the.Rings.Extended.Edition.2160p.mkv", true)]
    [InlineData("Standard.Movie.1080p.mkv", false)]
    public void EditionRegex_IdentifiesEditionsCorrectly(string filename, bool shouldMatch)
    {
        var match = EditionRegex.Match(filename);
        Assert.Equal(shouldMatch, match.Success);
    }

    [Theory]
    [InlineData("Dexter.S01E01.720p.English - Vegamovies.to.mkv", @"D:\ent\series\dexter\main\Dexter.S01.720p.English - Vegamovies.to\Dexter.S01E01.720p.English - Vegamovies.to.mkv", "Dexter", 1, 1)]
    [InlineData("Mr.Robot.S02E01+E02.720p.Hindi.Eng.Vegamovies.NL.mkv", @"D:\ent\series\Mr. Robot\Mr.Robot.S02.720p.Hindi.Vegamovies.NL\Mr.Robot.S02E01+E02.720p.Hindi.Eng.Vegamovies.NL.mkv", "Mr. Robot", 2, 1)]
    [InlineData("Moon Knight S01E02 Summon the Suit 1080p HQ DSNP WEB-DL x264 (DD+ 5.1 - 192Kbps) [Tel + Tam + Hin + Mal + Eng] MSub _Vegamovies.NL.mkv", @"D:\ent\series\Moon Knight S01E01-6\Moon Knight S01E02.mkv", "Moon Knight", 1, 2)]
    [InlineData("Loki.S01E01.Glorious.Purpose.1080p.x264.Hindi.English.Esubs.mkv", @"D:\ent\series\loki\Loki.S01E01.mkv", "Loki", 1, 1)]
    [InlineData("Dexter New Blood S01 E09 WebRip 720p HEVC-English AAC 5.1 x264 ESub - Vegamovies.NL.mp4", @"D:\ent\series\dexter\new blood\Dexter New Blood S01 E09.mp4", "Dexter: New Blood", 1, 9)]
    [InlineData("Dexter.Original.Sin.S01E02.Kid.in.a.Candy.Store.1080p.WEB-DL.x264.6CH-Vegamovies.is.mkv", @"D:\ent\series\dexter\original sin\Dexter.Original.Sin.S01E02.mkv", "Dexter: Original Sin", 1, 2)]
    public void ParseTVShowDetails_ParsesComplexFilenamesCorrectly(string fileName, string filePath, string expectedShow, int expectedSeason, int expectedEpisode)
    {
        var (show, season, episode, epTitle, year) = Vistara.Services.Scanning.LibraryScannerService.ParseTVShowDetails(
            System.IO.Path.GetFileNameWithoutExtension(fileName), filePath);

        Assert.Equal(expectedShow, show);
        Assert.Equal(expectedSeason, season);
        Assert.Equal(expectedEpisode, episode);
    }
}
