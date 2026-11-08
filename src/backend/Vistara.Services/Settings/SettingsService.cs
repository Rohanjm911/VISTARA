using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.MediaEngine;

namespace Vistara.Services.Settings;

public interface ISettingsService
{
    Task<Dictionary<string, string>> GetAllSettingsAsync(CancellationToken cancellationToken = default);
    Task<Dictionary<string, string>> GetUserPreferencesAsync(CancellationToken cancellationToken = default);
    Task UpdateSettingAsync(string key, string value, CancellationToken cancellationToken = default);
    Task UpdateUserPreferenceAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<bool> TestFFmpegAsync(string? ffmpegPath = null, string? ffprobePath = null);
    Task ResetToDefaultsAsync(CancellationToken cancellationToken = default);
}

public class SettingsService : ISettingsService
{
    private readonly VistaraDbContext _context;
    private readonly IFFmpegRunner _ffmpegRunner;

    public SettingsService(VistaraDbContext context, IFFmpegRunner ffmpegRunner)
    {
        _context = context;
        _ffmpegRunner = ffmpegRunner;
    }

    public async Task<Dictionary<string, string>> GetAllSettingsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.AppSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value, cancellationToken);
    }

    public async Task<Dictionary<string, string>> GetUserPreferencesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.UserPreferences
            .ToDictionaryAsync(p => p.Key, p => p.Value, cancellationToken);
    }

    public async Task UpdateSettingAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        var setting = await _context.AppSettings.FirstOrDefaultAsync(s => s.Key == key, cancellationToken);
        if (setting == null)
        {
            setting = new AppSetting { Key = key, Value = value, UpdatedAtUtc = DateTime.UtcNow };
            _context.AppSettings.Add(setting);
        }
        else
        {
            setting.Value = value;
            setting.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateUserPreferenceAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        var pref = await _context.UserPreferences.FirstOrDefaultAsync(p => p.Key == key, cancellationToken);
        if (pref == null)
        {
            pref = new UserPreference { Key = key, Value = value, UpdatedAtUtc = DateTime.UtcNow };
            _context.UserPreferences.Add(pref);
        }
        else
        {
            pref.Value = value;
            pref.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> TestFFmpegAsync(string? ffmpegPath = null, string? ffprobePath = null)
    {
        return await _ffmpegRunner.TestBinariesAsync();
    }

    public async Task ResetToDefaultsAsync(CancellationToken cancellationToken = default)
    {
        _context.AppSettings.RemoveRange(await _context.AppSettings.ToListAsync(cancellationToken));
        _context.UserPreferences.RemoveRange(await _context.UserPreferences.ToListAsync(cancellationToken));
        await _context.SaveChangesAsync(cancellationToken);
        await DbInitializer.InitializeAsync(_context);
    }
}

