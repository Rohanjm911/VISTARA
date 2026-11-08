using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Infrastructure.Data;

namespace Vistara.Services.Search;

public interface IFtsSearchService
{
    Task<SearchResultDto> SearchAsync(string query, int limitPerCategory = 10, CancellationToken cancellationToken = default);
}

public class FtsSearchService : IFtsSearchService
{
    private readonly VistaraDbContext _context;

    public FtsSearchService(VistaraDbContext context)
    {
        _context = context;
    }

    public async Task<SearchResultDto> SearchAsync(string query, int limitPerCategory = 10, CancellationToken cancellationToken = default)
    {
        var result = new SearchResultDto { Query = query };

        if (string.IsNullOrWhiteSpace(query))
            return result;

        var sanitized = query.Replace("\"", "\"\"").Trim();
        var ftsQuery = $"\"{sanitized}\"*";

        var matchedIds = new List<(Guid MediaItemId, string MediaType)>();

        using (var command = _context.Database.GetDbConnection().CreateCommand())
        {
            command.CommandText = @"
                SELECT MediaItemId, MediaType 
                FROM MediaSearchIndex 
                WHERE MediaSearchIndex MATCH @query 
                ORDER BY rank 
                LIMIT 100;
            ";
            var param = command.CreateParameter();
            param.ParameterName = "@query";
            param.Value = ftsQuery;
            command.Parameters.Add(param);

            if (command.Connection?.State != System.Data.ConnectionState.Open)
                await _context.Database.OpenConnectionAsync(cancellationToken);

            using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var idStr = reader.GetString(0);
                var typeStr = reader.GetString(1);
                if (Guid.TryParse(idStr, out var id))
                {
                    matchedIds.Add((id, typeStr));
                }
            }
        }

        // Also do a simple ILIKE fallback if FTS didn't match (for single letter / punctuation queries)
        if (matchedIds.Count == 0)
        {
            var fallback = await _context.MediaItems
                .Where(m => EF.Functions.Like(m.Title, $"%{query}%"))
                .Take(50)
                .Select(m => new { m.Id, Type = m.Type.ToString() })
                .ToListAsync(cancellationToken);

            foreach (var f in fallback)
            {
                matchedIds.Add((f.Id, f.Type));
            }
        }

        var movieIds = matchedIds.Where(m => m.MediaType == "Movie").Select(m => m.MediaItemId).Take(limitPerCategory).ToList();
        var episodeIds = matchedIds.Where(m => m.MediaType == "Episode").Select(m => m.MediaItemId).Take(limitPerCategory).ToList();
        var trackIds = matchedIds.Where(m => m.MediaType == "Track").Select(m => m.MediaItemId).Take(limitPerCategory).ToList();
        var photoIds = matchedIds.Where(m => m.MediaType == "Photo").Select(m => m.MediaItemId).Take(limitPerCategory).ToList();

        // Query Movies
        if (movieIds.Count > 0)
        {
            result.Movies = await _context.Movies
                .Include(m => m.MediaItem)
                    .ThenInclude(mi => mi!.PrimaryArtwork)
                .Include(m => m.Editions)
                    .ThenInclude(e => e.MediaFile)
                .Where(m => movieIds.Contains(m.MediaItemId))
                .Select(m => new MovieDto
                {
                    Id = m.MediaItemId,
                    MovieId = m.Id,
                    Title = m.MediaItem!.Title,
                    Year = m.MediaItem.Year,
                    Overview = m.MediaItem.Overview,
                    RuntimeMinutes = m.MediaItem.RuntimeMinutes,
                    CommunityRating = m.MediaItem.CommunityRating,
                    Director = m.Director,
                    PosterUrl = m.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{m.MediaItem.PrimaryArtwork.Id}" : null
                })
                .ToListAsync(cancellationToken);
        }

        // Query TV Shows directly
        result.TVShows = await _context.TVShows
            .Include(s => s.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(s => s.Seasons)
            .Where(s => EF.Functions.Like(s.MediaItem!.Title, $"%{query}%"))
            .Take(limitPerCategory)
            .Select(s => new TVShowDto
            {
                Id = s.MediaItemId,
                ShowId = s.Id,
                Title = s.MediaItem!.Title,
                Year = s.MediaItem.Year,
                Overview = s.MediaItem.Overview,
                Network = s.Network,
                PosterUrl = s.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{s.MediaItem.PrimaryArtwork.Id}" : null,
                SeasonCount = s.Seasons.Count
            })
            .ToListAsync(cancellationToken);

        // Query Tracks
        if (trackIds.Count > 0)
        {
            result.Tracks = await _context.Tracks
                .Include(t => t.MediaItem)
                    .ThenInclude(m => m!.PrimaryArtwork)
                .Include(t => t.MediaItem)
                    .ThenInclude(m => m!.Files)
                .Include(t => t.Album)
                .Include(t => t.Artist)
                .Where(t => trackIds.Contains(t.MediaItemId))
                .Select(t => new TrackDto
                {
                    Id = t.MediaItemId,
                    TrackId = t.Id,
                    Title = t.Title,
                    ArtistName = t.Artist != null ? t.Artist.Name : null,
                    AlbumTitle = t.Album != null ? t.Album.Title : null,
                    DurationSeconds = t.DurationSeconds,
                    MediaFileId = t.MediaItem!.Files.FirstOrDefault() != null ? t.MediaItem.Files.First().Id : Guid.Empty,
                    ArtworkUrl = t.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{t.MediaItem.PrimaryArtwork.Id}" : null
                })
                .ToListAsync(cancellationToken);
        }

        // Query Artists
        result.Artists = await _context.Artists
            .Include(a => a.Artwork)
            .Include(a => a.Albums)
            .Where(a => EF.Functions.Like(a.Name, $"%{query}%"))
            .Take(limitPerCategory)
            .Select(a => new ArtistDto
            {
                Id = a.Id,
                Name = a.Name,
                Biography = a.Biography,
                Country = a.Country,
                ArtworkUrl = a.Artwork != null ? $"/api/v1/artwork/{a.Artwork.Id}" : null,
                AlbumCount = a.Albums.Count
            })
            .ToListAsync(cancellationToken);

        // Query Albums
        result.Albums = await _context.Albums
            .Include(al => al.Artwork)
            .Include(al => al.Artist)
            .Where(al => EF.Functions.Like(al.Title, $"%{query}%"))
            .Take(limitPerCategory)
            .Select(al => new AlbumDto
            {
                Id = al.Id,
                ArtistId = al.ArtistId,
                ArtistName = al.Artist != null ? al.Artist.Name : string.Empty,
                Title = al.Title,
                ReleaseYear = al.ReleaseYear,
                ArtworkUrl = al.Artwork != null ? $"/api/v1/artwork/{al.Artwork.Id}" : null
            })
            .ToListAsync(cancellationToken);

        // Query Photos
        if (photoIds.Count > 0)
        {
            result.Photos = await _context.Photos
                .Include(p => p.MediaItem)
                    .ThenInclude(m => m!.Files)
                .Include(p => p.MediaItem)
                    .ThenInclude(m => m!.PrimaryArtwork)
                .Where(p => photoIds.Contains(p.MediaItemId))
                .Select(p => new PhotoDto
                {
                    Id = p.MediaItemId,
                    PhotoId = p.Id,
                    Title = p.MediaItem!.Title,
                    DateTakenUtc = p.DateTakenUtc,
                    CameraMake = p.CameraMake,
                    CameraModel = p.CameraModel,
                    Width = p.Width,
                    Height = p.Height,
                    ThumbnailUrl = p.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{p.MediaItem.PrimaryArtwork.Id}" : $"/api/v1/stream/{p.MediaItem.Files.First().Id}",
                    FullImageUrl = $"/api/v1/stream/{p.MediaItem.Files.First().Id}",
                    MediaFileId = p.MediaItem.Files.First().Id
                })
                .ToListAsync(cancellationToken);
        }

        return result;
    }
}

