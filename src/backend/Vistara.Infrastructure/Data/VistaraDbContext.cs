using Microsoft.EntityFrameworkCore;
using Vistara.Core.Models;

namespace Vistara.Infrastructure.Data;

public class VistaraDbContext : DbContext
{
    public VistaraDbContext(DbContextOptions<VistaraDbContext> options) : base(options)
    {
    }

    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<LibraryFolder> LibraryFolders => Set<LibraryFolder>();
    public DbSet<ScanHistory> ScanHistories => Set<ScanHistory>();

    public DbSet<MediaItem> MediaItems => Set<MediaItem>();
    public DbSet<MediaFile> MediaFiles => Set<MediaFile>();
    public DbSet<MediaStream> MediaStreams => Set<MediaStream>();
    public DbSet<Artwork> Artworks => Set<Artwork>();

    public DbSet<Movie> Movies => Set<Movie>();
    public DbSet<MovieEdition> MovieEditions => Set<MovieEdition>();
    public DbSet<MovieCollection> MovieCollections => Set<MovieCollection>();

    public DbSet<TVShow> TVShows => Set<TVShow>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<Episode> Episodes => Set<Episode>();

    public DbSet<Artist> Artists => Set<Artist>();
    public DbSet<Album> Albums => Set<Album>();
    public DbSet<Track> Tracks => Set<Track>();
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<PlaylistTrack> PlaylistTracks => Set<PlaylistTrack>();

    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<PhotoAlbum> PhotoAlbums => Set<PhotoAlbum>();
    public DbSet<PhotoAlbumItem> PhotoAlbumItems => Set<PhotoAlbumItem>();

    public DbSet<PlaybackProgress> PlaybackProgress => Set<PlaybackProgress>();
    public DbSet<PlaybackSession> PlaybackSessions => Set<PlaybackSession>();

    public DbSet<Genre> Genres => Set<Genre>();
    public DbSet<MediaGenre> MediaGenres => Set<MediaGenre>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<MediaTag> MediaTags => Set<MediaTag>();

    public DbSet<BackgroundJob> BackgroundJobs => Set<BackgroundJob>();
    public DbSet<ScheduledTask> ScheduledTasks => Set<ScheduledTask>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<UserPreference> UserPreferences => Set<UserPreference>();
    public DbSet<AppLog> AppLogs => Set<AppLog>();
    public DbSet<BackupHistory> BackupHistories => Set<BackupHistory>();
    public DbSet<MetadataCache> MetadataCaches => Set<MetadataCache>();

    public DbSet<IntegrityScan> IntegrityScans => Set<IntegrityScan>();
    public DbSet<IntegrityFileRecord> IntegrityFileRecords => Set<IntegrityFileRecord>();
    public DbSet<IntegrityVerificationHistory> IntegrityVerificationHistories => Set<IntegrityVerificationHistory>();
    public DbSet<IntegrityEvent> IntegrityEvents => Set<IntegrityEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // AppSetting & UserPreference keys
        modelBuilder.Entity<AppSetting>().HasKey(s => s.Key);
        modelBuilder.Entity<UserPreference>().HasKey(p => p.Key);

        // MediaGenre & MediaTag composite keys
        modelBuilder.Entity<MediaGenre>().HasKey(mg => new { mg.MediaItemId, mg.GenreId });
        modelBuilder.Entity<MediaTag>().HasKey(mt => new { mt.MediaItemId, mt.TagId });

        // LibraryFolder unique path
        modelBuilder.Entity<LibraryFolder>()
            .HasIndex(f => f.Path)
            .IsUnique();

        // MediaFile absolute path unique index
        modelBuilder.Entity<MediaFile>()
            .HasIndex(f => f.AbsolutePath)
            .IsUnique();

        modelBuilder.Entity<MediaFile>()
            .HasIndex(f => f.FileHashSha256);

        // Entity relationships and indexes
        modelBuilder.Entity<Movie>()
            .HasIndex(m => m.MediaItemId)
            .IsUnique();

        modelBuilder.Entity<TVShow>()
            .HasIndex(s => s.MediaItemId)
            .IsUnique();

        modelBuilder.Entity<Episode>()
            .HasIndex(e => e.MediaItemId)
            .IsUnique();

        modelBuilder.Entity<Track>()
            .HasIndex(t => t.MediaItemId)
            .IsUnique();

        modelBuilder.Entity<Photo>()
            .HasIndex(p => p.MediaItemId)
            .IsUnique();

        modelBuilder.Entity<PlaybackProgress>()
            .HasIndex(p => p.MediaItemId);

        modelBuilder.Entity<PlaybackProgress>()
            .HasIndex(p => new { p.MediaItemId, p.MediaFileId });

        modelBuilder.Entity<MediaItem>()
            .HasIndex(m => m.Title);

        modelBuilder.Entity<MediaItem>()
            .HasIndex(m => m.Type);

        modelBuilder.Entity<MediaItem>()
            .HasIndex(m => m.IsFavourite);

        modelBuilder.Entity<MediaItem>()
            .HasIndex(m => m.IsInWatchlist);

        // Cascade deletes where appropriate
        modelBuilder.Entity<Library>()
            .HasMany(l => l.Folders)
            .WithOne(f => f.Library)
            .HasForeignKey(f => f.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Artwork>()
            .HasOne(a => a.MediaItem)
            .WithMany()
            .HasForeignKey(a => a.MediaItemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MediaItem>()
            .HasOne(m => m.PrimaryArtwork)
            .WithMany()
            .HasForeignKey(m => m.PrimaryArtworkId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<MediaItem>()
            .HasOne(m => m.BackdropArtwork)
            .WithMany()
            .HasForeignKey(m => m.BackdropArtworkId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Library>()
            .HasMany(l => l.MediaItems)
            .WithOne(m => m.Library)
            .HasForeignKey(m => m.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MediaItem>()
            .HasMany(m => m.Files)
            .WithOne(f => f.MediaItem)
            .HasForeignKey(f => f.MediaItemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MediaItem>()
            .HasMany(m => m.Genres)
            .WithOne(g => g.MediaItem)
            .HasForeignKey(g => g.MediaItemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MediaItem>()
            .HasMany(m => m.Tags)
            .WithOne(t => t.MediaItem)
            .HasForeignKey(t => t.MediaItemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TVShow>()
            .HasMany(s => s.Seasons)
            .WithOne(se => se.TVShow)
            .HasForeignKey(se => se.TVShowId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Season>()
            .HasMany(s => s.Episodes)
            .WithOne(e => e.Season)
            .HasForeignKey(e => e.SeasonId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Artist>()
            .HasMany(a => a.Albums)
            .WithOne(al => al.Artist)
            .HasForeignKey(al => al.ArtistId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Album>()
            .HasMany(a => a.Tracks)
            .WithOne(t => t.Album)
            .HasForeignKey(t => t.AlbumId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Playlist>()
            .HasMany(p => p.Items)
            .WithOne(pi => pi.Playlist)
            .HasForeignKey(pi => pi.PlaylistId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PhotoAlbum>()
            .HasMany(pa => pa.Items)
            .WithOne(pai => pai.PhotoAlbum)
            .HasForeignKey(pai => pai.PhotoAlbumId)
            .OnDelete(DeleteBehavior.Cascade);

        // Media Integrity Monitor indexes
        modelBuilder.Entity<IntegrityFileRecord>()
            .HasIndex(r => r.FilePath)
            .IsUnique();

        modelBuilder.Entity<IntegrityFileRecord>()
            .HasIndex(r => r.Status);

        modelBuilder.Entity<IntegrityFileRecord>()
            .HasIndex(r => r.LibraryId);

        modelBuilder.Entity<IntegrityFileRecord>()
            .HasIndex(r => r.MediaFileId);

        modelBuilder.Entity<IntegrityScan>()
            .HasIndex(s => s.Status);

        modelBuilder.Entity<IntegrityScan>()
            .HasIndex(s => s.StartedAtUtc);

        modelBuilder.Entity<IntegrityEvent>()
            .HasIndex(e => e.TimestampUtc);

        modelBuilder.Entity<IntegrityEvent>()
            .HasIndex(e => e.EventType);

        modelBuilder.Entity<IntegrityVerificationHistory>()
            .HasIndex(h => h.FilePath);

        modelBuilder.Entity<IntegrityVerificationHistory>()
            .HasIndex(h => h.VerifiedAtUtc);
    }
}
