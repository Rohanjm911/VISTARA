import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image,
  Info,
  Maximize2,
  Play,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { PhotoAlbumDto, PhotoDto } from '../types';

export const GalleryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'albums'>('timeline');
  const [timelineGroups, setTimelineGroups] = useState<{ monthYear: string; count: number; photos: PhotoDto[] }[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbumDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Lightbox Fullscreen Viewer State
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoDto | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showExif, setShowExif] = useState(false);
  const [isSlideshowRunning, setIsSlideshowRunning] = useState(false);

  const fetchGallery = async () => {
    setLoading(true);
    if (activeTab === 'timeline') {
      const res = await apiRequest<{ monthYear: string; count: number; photos: PhotoDto[] }[]>('/api/v1/gallery/timeline');
      if (res.success && res.data) setTimelineGroups(res.data);
    } else {
      const res = await apiRequest<PhotoAlbumDto[]>('/api/v1/gallery/albums');
      if (res.success && res.data) setAlbums(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGallery();
  }, [activeTab]);

  // Slideshow auto-advance timer
  useEffect(() => {
    if (!isSlideshowRunning || !selectedPhoto) return;

    const timer = setInterval(() => {
      // Find next photo across all groups
      const allPhotos = timelineGroups.flatMap((g) => g.photos);
      const currentIndex = allPhotos.findIndex((p) => p.id === selectedPhoto.id);
      if (currentIndex >= 0 && currentIndex < allPhotos.length - 1) {
        setSelectedPhoto(allPhotos[currentIndex + 1]);
      } else if (allPhotos.length > 0) {
        setSelectedPhoto(allPhotos[0]);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [isSlideshowRunning, selectedPhoto, timelineGroups]);

  const openLightbox = (photo: PhotoDto) => {
    setSelectedPhoto(photo);
    setZoomLevel(1);
    setRotation(0);
    setShowExif(false);
  };

  const closeLightbox = () => {
    setSelectedPhoto(null);
    setIsSlideshowRunning(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#242a36] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white uppercase">Photo Studio</h1>
          <p className="text-xs text-[#9ca3af]">Chronological personal photo archive</p>
        </div>

        <div className="flex bg-[#181c24] border border-[#242a36] rounded-md p-1 text-xs">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'timeline' ? 'bg-accent text-white font-bold' : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('albums')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'albums' ? 'bg-accent text-white font-bold' : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Albums
          </button>
        </div>
      </div>

      {/* Timeline View */}
      {activeTab === 'timeline' ? (
        <div className="space-y-8">
          {timelineGroups.length === 0 && !loading ? (
            <div className="py-16 text-center text-[#9ca3af] space-y-3">
              <Image className="w-12 h-12 mx-auto text-[#6b7280]" />
              <div className="text-sm font-bold text-white">No Photos in Library</div>
              <p className="text-xs max-w-sm mx-auto">
                Add a photos folder in Libraries to view your gallery with full EXIF camera data.
              </p>
            </div>
          ) : (
            timelineGroups.map((group) => (
              <div key={group.monthYear} className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#9ca3af] uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span className="text-white">{group.monthYear}</span>
                  <span>({group.count})</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {group.photos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => openLightbox(photo)}
                      className="aspect-square bg-[#12151b] border border-[#242a36] hover:border-accent rounded-md overflow-hidden cursor-pointer transition-colors relative group"
                    >
                      <img
                        src={photo.thumbnailUrl}
                        alt={photo.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Albums Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {albums.map((album) => (
            <div
              key={album.id}
              className="bg-[#12151b] border border-[#242a36] hover:border-accent rounded-lg p-3 cursor-pointer transition-colors"
            >
              <div className="aspect-square bg-[#181c24] rounded-md overflow-hidden mb-3">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                    <Image className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="font-bold text-xs text-white truncate">{album.name}</div>
              <div className="text-[11px] text-[#9ca3af] mt-0.5">{album.photoCount} photos</div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-6 select-none">
          {/* Lightbox Header Bar */}
          <div className="flex items-center justify-between text-white z-10">
            <div>
              <div className="font-bold text-sm">{selectedPhoto.title}</div>
              {selectedPhoto.dateTakenUtc && (
                <div className="text-[11px] text-[#9ca3af]">
                  {new Date(selectedPhoto.dateTakenUtc).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Action Tools */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsSlideshowRunning(!isSlideshowRunning)}
                title="Toggle Slideshow"
                className={`p-2 rounded transition-colors ${
                  isSlideshowRunning ? 'bg-accent text-white' : 'text-[#9ca3af] hover:text-white bg-[#181c24]'
                }`}
              >
                <Play className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                title="Zoom In"
                className="p-2 rounded bg-[#181c24] text-[#9ca3af] hover:text-white transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="Zoom Out"
                className="p-2 rounded bg-[#181c24] text-[#9ca3af] hover:text-white transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate 90°"
                className="p-2 rounded bg-[#181c24] text-[#9ca3af] hover:text-white transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowExif(!showExif)}
                title="Toggle Camera EXIF Info"
                className={`p-2 rounded transition-colors ${
                  showExif ? 'bg-accent text-white' : 'text-[#9ca3af] hover:text-white bg-[#181c24]'
                }`}
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                onClick={closeLightbox}
                className="p-2 rounded bg-[#181c24] text-[#9ca3af] hover:text-white hover:bg-rose-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Photo Display Viewport */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden my-4">
            <img
              src={selectedPhoto.fullImageUrl}
              alt={selectedPhoto.title}
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-[82vh] max-w-[90vw] object-contain shadow-2xl"
            />

            {/* EXIF Metadata Sidebar Overlay */}
            {showExif && (
              <div className="absolute right-4 top-4 bottom-4 w-72 bg-[#12151b]/95 border border-[#242a36] rounded-lg p-4 text-xs font-mono text-[#d1d5db] shadow-2xl backdrop-blur-sm overflow-y-auto space-y-3">
                <div className="font-bold text-white border-b border-[#242a36] pb-2 flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-accent" />
                  <span>EXIF Camera Details</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  {selectedPhoto.cameraMake && (
                    <div>
                      <span className="text-[#9ca3af] block">Camera:</span>
                      <span className="font-bold text-white">
                        {selectedPhoto.cameraMake} {selectedPhoto.cameraModel}
                      </span>
                    </div>
                  )}

                  {selectedPhoto.lensModel && (
                    <div>
                      <span className="text-[#9ca3af] block">Lens:</span>
                      <span className="text-white">{selectedPhoto.lensModel}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#242a36]">
                    <div>
                      <span className="text-[#9ca3af] block">Focal Length:</span>
                      <span className="text-white">{selectedPhoto.focalLengthMm ? `${selectedPhoto.focalLengthMm}mm` : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[#9ca3af] block">Aperture:</span>
                      <span className="text-white">{selectedPhoto.apertureFNumber ? `f/${selectedPhoto.apertureFNumber}` : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[#9ca3af] block">Shutter Speed:</span>
                      <span className="text-white">{selectedPhoto.shutterSpeed || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[#9ca3af] block">ISO:</span>
                      <span className="text-white">{selectedPhoto.isoSpeed || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-[#242a36]">
                    <span className="text-[#9ca3af] block">Dimensions:</span>
                    <span className="text-white">{selectedPhoto.width} x {selectedPhoto.height} px</span>
                  </div>

                  {selectedPhoto.fileSizeBytes && (
                    <div>
                      <span className="text-[#9ca3af] block">File Size:</span>
                      <span className="text-white">{(selectedPhoto.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

