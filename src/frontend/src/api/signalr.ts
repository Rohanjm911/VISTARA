import * as signalR from '@microsoft/signalr';
import { BackgroundJobDto, IntegrityFileRecordDto, IntegrityScanDto, IntegrityScanProgressDto, PlaybackProgressDto, ScanProgressDto } from '../types';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private scanProgressCallbacks: ((progress: ScanProgressDto) => void)[] = [];
  private jobUpdatedCallbacks: ((job: BackgroundJobDto) => void)[] = [];
  private playbackProgressCallbacks: ((progress: PlaybackProgressDto) => void)[] = [];
  private notificationCallbacks: ((message: string, level: string) => void)[] = [];
  private integrityProgressCallbacks: ((progress: IntegrityScanProgressDto) => void)[] = [];
  private integrityIssueCallbacks: ((issue: IntegrityFileRecordDto) => void)[] = [];
  private integrityCompletedCallbacks: ((scan: IntegrityScanDto) => void)[] = [];

  public start() {
    this.startConnection();
  }

  public startConnection() {
    if (this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/vistara')
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('ScanProgress', (progress: ScanProgressDto) => {
      this.scanProgressCallbacks.forEach((cb) => cb(progress));
    });

    this.connection.on('JobUpdated', (job: BackgroundJobDto) => {
      this.jobUpdatedCallbacks.forEach((cb) => cb(job));
    });

    this.connection.on('PlaybackProgressUpdated', (progress: PlaybackProgressDto) => {
      this.playbackProgressCallbacks.forEach((cb) => cb(progress));
    });

    this.connection.on('SystemNotification', (message: string, level: string) => {
      this.notificationCallbacks.forEach((cb) => cb(message, level));
    });

    this.connection.on('IntegrityScanProgress', (progress: IntegrityScanProgressDto) => {
      this.integrityProgressCallbacks.forEach((cb) => cb(progress));
    });

    this.connection.on('IntegrityIssueDetected', (issue: IntegrityFileRecordDto) => {
      this.integrityIssueCallbacks.forEach((cb) => cb(issue));
    });

    this.connection.on('IntegrityScanCompleted', (scan: IntegrityScanDto) => {
      this.integrityCompletedCallbacks.forEach((cb) => cb(scan));
    });

    this.connection.start().catch((err) => {
      console.warn('SignalR Connection Error (retrying automatically):', err);
    });
  }

  public onScanProgress(cb: (progress: ScanProgressDto) => void) {
    this.scanProgressCallbacks.push(cb);
    return () => {
      this.scanProgressCallbacks = this.scanProgressCallbacks.filter((c) => c !== cb);
    };
  }

  public onJobUpdated(cb: (job: BackgroundJobDto) => void) {
    this.jobUpdatedCallbacks.push(cb);
    return () => {
      this.jobUpdatedCallbacks = this.jobUpdatedCallbacks.filter((c) => c !== cb);
    };
  }

  public onPlaybackProgress(cb: (progress: PlaybackProgressDto) => void) {
    this.playbackProgressCallbacks.push(cb);
    return () => {
      this.playbackProgressCallbacks = this.playbackProgressCallbacks.filter((c) => c !== cb);
    };
  }

  public onNotification(cb: (message: string, level: string) => void) {
    this.notificationCallbacks.push(cb);
    return () => {
      this.notificationCallbacks = this.notificationCallbacks.filter((c) => c !== cb);
    };
  }

  public onIntegrityProgress(cb: (progress: IntegrityScanProgressDto) => void) {
    this.integrityProgressCallbacks.push(cb);
    return () => {
      this.integrityProgressCallbacks = this.integrityProgressCallbacks.filter((c) => c !== cb);
    };
  }

  public onIntegrityIssue(cb: (issue: IntegrityFileRecordDto) => void) {
    this.integrityIssueCallbacks.push(cb);
    return () => {
      this.integrityIssueCallbacks = this.integrityIssueCallbacks.filter((c) => c !== cb);
    };
  }

  public onIntegrityCompleted(cb: (scan: IntegrityScanDto) => void) {
    this.integrityCompletedCallbacks.push(cb);
    return () => {
      this.integrityCompletedCallbacks = this.integrityCompletedCallbacks.filter((c) => c !== cb);
    };
  }
}

export const signalRService = new SignalRService();

export const onScanProgress = (cb: (progress: ScanProgressDto) => void) =>
  signalRService.onScanProgress(cb);

export const onBackgroundJobUpdate = (cb: (job: BackgroundJobDto) => void) =>
  signalRService.onJobUpdated(cb);

export const onPlaybackProgress = (cb: (progress: PlaybackProgressDto) => void) =>
  signalRService.onPlaybackProgress(cb);

export const onNotification = (cb: (message: string, level: string) => void) =>
  signalRService.onNotification(cb);
