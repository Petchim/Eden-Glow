import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import AIcon from '../components/AIcon.tsx';
import { Badge, Card, Confirm, Empty, ErrorNote, Field, Loading, Modal, PageHeader, Segmented } from '../components/ui.tsx';
import InstagramEmbed from '../../components/InstagramEmbed.tsx';
import { api, type ApiError } from '../api/index.ts';
import type { MediaPublishStatus, MediaType, R2MediaItem } from '../../types/media.ts';
import type { GalleryVideo, VideoStatus } from '../../types/video.ts';
import { parseInstagramUrl } from '../../utils/instagram.ts';
import { validateMediaFile } from '../../config/media.ts';
import { asApiError, useAction, useAdminTitle } from '../hooks.ts';
import { useAuth } from '../auth.tsx';
import { fmtDateTime } from '../lib/format.ts';

type ViewMode = 'R2_MEDIA' | 'INSTAGRAM';
type MediaFilter = 'ALL' | 'IMAGE' | 'VIDEO' | MediaPublishStatus;
type VideoFilter = 'ALL' | VideoStatus;

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Salon Interior', 'Transformations'];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function GalleryAdmin() {
  useAdminTitle('Gallery Management → Media & Videos');
  const { expired } = useAuth();
  const action = useAction();

  // Active view mode
  const [viewMode, setViewMode] = useState<ViewMode>('R2_MEDIA');

  // ---------- Cloudflare R2 Media State ----------
  const [mediaItems, setMediaItems] = useState<R2MediaItem[]>([]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<ApiError | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<MediaType>('IMAGE');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [uploadStatus, setUploadStatus] = useState<MediaPublishStatus>('PUBLISHED');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFormError, setUploadFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deleting & previewing item
  const [deletingMedia, setDeletingMedia] = useState<R2MediaItem | null>(null);
  const [viewingMedia, setViewingMedia] = useState<R2MediaItem | null>(null);

  // ---------- Instagram Embed State ----------
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('ALL');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<ApiError | null>(null);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputStatus, setInputStatus] = useState<VideoStatus>('PUBLISHED');
  const [videoFormError, setVideoFormError] = useState<string | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<GalleryVideo | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null);

  // Clean up object URLs to avoid memory leaks
  const cleanupPreviewUrls = useCallback(() => {
    previewUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    setPreviewUrls([]);
  }, [previewUrls]);

  // Load R2 Media
  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      const list = await api.media.list('ALL');
      setMediaItems(list);
    } catch (e) {
      const err = asApiError(e);
      if (err.status === 401) expired();
      setMediaError(err);
    } finally {
      setMediaLoading(false);
    }
  }, [expired]);

  // Load Instagram Videos
  const loadVideos = useCallback(async () => {
    setVideoLoading(true);
    setVideoError(null);
    try {
      const list = await api.videos.list('ALL');
      setVideos(list);
    } catch (e) {
      const err = asApiError(e);
      if (err.status === 401) expired();
      setVideoError(err);
    } finally {
      setVideoLoading(false);
    }
  }, [expired]);

  useEffect(() => {
    loadMedia();
    loadVideos();
    return () => {
      cleanupPreviewUrls();
    };
  }, [loadMedia, loadVideos]);

  // File selection & live preview generator
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFormError(null);
    cleanupPreviewUrls();

    const files = Array.from(e.target.files || []);
    if (!files.length) {
      setSelectedFiles([]);
      return;
    }

    // Validate each file
    const generatedUrls: string[] = [];
    for (const f of files) {
      const val = validateMediaFile(f);
      if (!val.valid) {
        setUploadFormError(val.error || 'Invalid file format or size limit.');
        setSelectedFiles([]);
        return;
      }
      try {
        generatedUrls.push(URL.createObjectURL(f));
      } catch {
        // fallback
      }
    }

    setSelectedFiles(files);
    setPreviewUrls(generatedUrls);
  };

  const closeUploadModal = () => {
    cleanupPreviewUrls();
    setSelectedFiles([]);
    setUploadTitle('');
    setUploadProgress(null);
    setUploadFormError(null);
    setUploadModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit media upload
  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFiles.length) {
      setUploadFormError('Please select at least one file to upload.');
      return;
    }

    setUploadFormError(null);
    setUploadProgress(10);

    try {
      let uploadedCount = 0;
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        await api.media.upload(
          file,
          {
            title: uploadTitle || file.name.replace(/\.[^/.]+$/, ''),
            category: uploadType === 'IMAGE' ? uploadCategory : undefined,
            status: uploadStatus,
          },
          (pct) => {
            const overall = Math.round(((i + pct / 100) / selectedFiles.length) * 100);
            setUploadProgress(overall);
          },
        );
        uploadedCount++;
      }

      setNotice({
        tone: 'ok',
        text: `Successfully uploaded and saved ${uploadedCount} file(s) to Cloudflare R2 as ${uploadStatus}.`,
      });
      closeUploadModal();
      loadMedia();
    } catch (err) {
      const e = asApiError(err);
      setUploadFormError(e.message || 'Media upload failed. Please try again.');
      setUploadProgress(null);
    }
  };

  // Toggle R2 Media status
  const handleToggleMediaStatus = async (item: R2MediaItem) => {
    const nextStatus: MediaPublishStatus = item.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED';
    setBusyId(item.id);
    const updated = await action.run(() => api.media.setStatus(item.id, nextStatus));
    setBusyId(null);
    if (updated) {
      setMediaItems((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      setNotice({
        tone: 'info',
        text: `Media ${nextStatus === 'PUBLISHED' ? 'published to website gallery' : 'hidden from visitors'}.`,
      });
    }
  };

  // Reorder R2 Media
  const handleReorderMedia = async (item: R2MediaItem, direction: 'UP' | 'DOWN') => {
    setBusyId(item.id);
    const ok = await action.run(() => api.media.reorder(item.id, direction));
    setBusyId(null);
    if (ok) {
      loadMedia();
    }
  };

  // Delete R2 Media
  const handleDeleteMediaConfirm = async () => {
    if (!deletingMedia) return;
    setBusyId(deletingMedia.id);
    const ok = await action.run(() => api.media.delete(deletingMedia.id));
    setBusyId(null);
    setDeletingMedia(null);
    if (ok) {
      setNotice({ tone: 'ok', text: `Deleted "${deletingMedia.originalFileName}" from gallery & Cloudflare R2.` });
      loadMedia();
    }
  };

  // Filtered R2 Media
  const filteredMedia = useMemo(() => {
    let list = mediaItems;
    if (mediaFilter === 'IMAGE') list = list.filter((m) => m.mediaType === 'IMAGE');
    else if (mediaFilter === 'VIDEO') list = list.filter((m) => m.mediaType === 'VIDEO');
    else if (mediaFilter === 'PUBLISHED') list = list.filter((m) => m.status === 'PUBLISHED');
    else if (mediaFilter === 'HIDDEN') list = list.filter((m) => m.status === 'HIDDEN');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(q)) ||
          m.originalFileName.toLowerCase().includes(q) ||
          (m.category && m.category.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [mediaItems, mediaFilter, searchQuery]);

  const mediaCounts = useMemo(() => {
    const total = mediaItems.length;
    const images = mediaItems.filter((m) => m.mediaType === 'IMAGE').length;
    const videos = mediaItems.filter((m) => m.mediaType === 'VIDEO').length;
    const published = mediaItems.filter((m) => m.status === 'PUBLISHED').length;
    const hidden = total - published;
    return { total, images, videos, published, hidden };
  }, [mediaItems]);

  // ---------- Instagram Embed Handlers ----------
  const urlParseResult = useMemo(() => {
    if (!inputUrl.trim()) return null;
    const res = parseInstagramUrl(inputUrl);
    if (!res.valid) return res;
    const isDuplicate = videos.some((v) => v.id === res.docId || v.shortcode === res.shortcode);
    if (isDuplicate) return { valid: false as const, error: 'This Instagram video is already in your gallery.' };
    return res;
  }, [inputUrl, videos]);

  const closeAddVideoModal = useCallback(() => {
    setAddVideoOpen(false);
    setVideoFormError(null);
    setInputUrl('');
    action.setError(null);
  }, [action]);

  const handleSaveVideo = async (statusToSave: VideoStatus) => {
    if (!urlParseResult?.valid) {
      setVideoFormError(urlParseResult?.error || 'Please enter a valid Instagram URL.');
      return;
    }
    setVideoFormError(null);
    action.setError(null);
    const res = await action.run(() =>
      api.videos.create({
        url: urlParseResult.canonicalUrl,
        status: statusToSave,
      }),
    );
    if (res) {
      setAddVideoOpen(false);
      setInputUrl('');
      setInputStatus('PUBLISHED');
      setVideoFormError(null);
      setNotice({
        tone: 'ok',
        text: `Instagram post ${res.status === 'PUBLISHED' ? 'published to gallery' : 'saved as hidden'}.`,
      });
      loadVideos();
    }
  };

  const handleAddVideoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleSaveVideo(inputStatus);
  };

  const handleToggleVideoStatus = async (item: GalleryVideo) => {
    const nextStatus: VideoStatus = item.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED';
    setBusyId(item.id);
    const updated = await action.run(() => api.videos.setStatus(item.id, nextStatus));
    setBusyId(null);
    if (updated) {
      setVideos((list) => list.map((v) => (v.id === updated.id ? updated : v)));
      setNotice({ tone: 'info', text: `Instagram post ${nextStatus === 'PUBLISHED' ? 'published' : 'hidden'}.` });
    }
  };

  const handleReorderVideo = async (item: GalleryVideo, direction: 'UP' | 'DOWN') => {
    setBusyId(item.id);
    const ok = await action.run(() => api.videos.reorder(item.id, direction));
    setBusyId(null);
    if (ok) {
      loadVideos();
    }
  };

  const handleDeleteVideoConfirm = async () => {
    if (!deletingVideo) return;
    setBusyId(deletingVideo.id);
    const ok = await action.run(() => api.videos.delete(deletingVideo.id));
    setBusyId(null);
    setDeletingVideo(null);
    if (ok) {
      setNotice({ tone: 'ok', text: 'Instagram post removed from gallery.' });
      loadVideos();
    }
  };

  return (
    <div className="ad-page">
      <PageHeader
        title="Gallery Management"
        sub="Upload and manage high-resolution images and videos hosted in Cloudflare R2 storage, or curate official Instagram video embeds."
        actions={
          viewMode === 'R2_MEDIA' ? (
            <button
              type="button"
              className="ad-btn ad-btn--primary"
              onClick={() => {
                setUploadModalOpen(true);
              }}
            >
              <AIcon name="plus" />
              <span>Upload Media</span>
            </button>
          ) : (
            <button
              type="button"
              className="ad-btn ad-btn--primary"
              onClick={() => {
                setAddVideoOpen(true);
              }}
            >
              <AIcon name="plus" />
              <span>Add Instagram Post</span>
            </button>
          )
        }
      />

      {/* View Mode Switcher */}
      <div className="ad-gallery-mode-switch" style={{ marginBottom: '24px' }}>
        <Segmented
          label="Gallery Mode"
          options={[
            { value: 'R2_MEDIA', label: `Cloudflare R2 Media (${mediaCounts.total})` },
            { value: 'INSTAGRAM', label: `Instagram Embeds (${videos.length})` },
          ]}
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
        />
      </div>

      {notice && (
        <div className={`ad-notice ad-notice--${notice.tone}`} style={{ marginBottom: '20px' }}>
          <span>{notice.text}</span>
          <button type="button" className="ad-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss">
            <AIcon name="close" size={14} />
          </button>
        </div>
      )}

      {!addVideoOpen && <ErrorNote error={action.error} />}

      {/* =========================================================================
          VIEW MODE 1: CLOUDFLARE R2 MEDIA MANAGEMENT
          ========================================================================= */}
      {viewMode === 'R2_MEDIA' && (
        <>
          {/* Summary Metric Cards */}
          <div className="ad-grid-metrics" style={{ marginBottom: '24px' }}>
            <Card className="ad-metric">
              <span className="ad-metric-label">Total Cloudflare Media</span>
              <span className="ad-metric-val">{mediaCounts.total}</span>
              <span className="ad-metric-hint">Originals in Cloudflare R2</span>
            </Card>
            <Card className="ad-metric">
              <span className="ad-metric-label">Published Live</span>
              <span className="ad-metric-val" style={{ color: '#2e7d32' }}>
                {mediaCounts.published}
              </span>
              <span className="ad-metric-hint">Visible in public gallery</span>
            </Card>
            <Card className="ad-metric">
              <span className="ad-metric-label">Hidden / Draft</span>
              <span className="ad-metric-val" style={{ color: '#c27d38' }}>
                {mediaCounts.hidden}
              </span>
              <span className="ad-metric-hint">Hidden from visitors</span>
            </Card>
            <Card className="ad-metric">
              <span className="ad-metric-label">Media Types</span>
              <span className="ad-metric-val" style={{ fontSize: '1.4rem' }}>
                {mediaCounts.images} Img · {mediaCounts.videos} Vid
              </span>
              <span className="ad-metric-hint">Independent cloud storage</span>
            </Card>
          </div>

          {/* Filter & Search Bar */}
          <div className="ad-filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <Segmented
              label="Filter Media"
              options={[
                { value: 'ALL', label: `All (${mediaCounts.total})` },
                { value: 'IMAGE', label: `Images (${mediaCounts.images})` },
                { value: 'VIDEO', label: `Videos (${mediaCounts.videos})` },
                { value: 'PUBLISHED', label: `Published (${mediaCounts.published})` },
                { value: 'HIDDEN', label: `Hidden (${mediaCounts.hidden})` },
              ]}
              value={mediaFilter}
              onChange={(v) => setMediaFilter(v as MediaFilter)}
            />
            <div style={{ flex: 1, minWidth: '220px', maxWidth: '360px', marginLeft: 'auto' }}>
              <input
                type="search"
                className="ad-input"
                placeholder="Search media by title or filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Content States */}
          {mediaLoading && <Loading rows={4} />}
          {mediaError && <ErrorNote error={mediaError} onRetry={loadMedia} />}

          {!mediaLoading && !mediaError && filteredMedia.length === 0 && (
            <Empty
              title="No media found"
              text={
                searchQuery
                  ? 'No media matches your search query.'
                  : mediaFilter !== 'ALL'
                    ? `No media currently in "${mediaFilter}" filter.`
                    : 'Your Cloudflare R2 media gallery is empty. Click "Upload Media" to add your first high-resolution image or video!'
              }
              action={
                mediaFilter === 'ALL' && !searchQuery ? (
                  <button type="button" className="ad-btn ad-btn--primary" onClick={() => setUploadModalOpen(true)}>
                    <AIcon name="plus" />
                    <span>Upload First Media</span>
                  </button>
                ) : undefined
              }
            />
          )}

          {/* Media Grid */}
          {!mediaLoading && !mediaError && filteredMedia.length > 0 && (
            <div className="ad-gallery-video-grid">
              {filteredMedia.map((item, index) => {
                const isBusy = busyId === item.id;
                const isPublished = item.status === 'PUBLISHED';
                return (
                  <Card key={item.id} className="ad-video-card">
                    {/* Visual Preview */}
                    <div
                      className="ad-video-card-thumb"
                      style={{ cursor: 'pointer', position: 'relative', background: '#0a0a0a' }}
                      onClick={() => setViewingMedia(item)}
                    >
                      {item.mediaType === 'IMAGE' ? (
                        <img
                          src={item.publicUrl}
                          alt={item.title || item.originalFileName}
                          loading="lazy"
                          style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ position: 'relative', width: '100%', height: '220px', background: '#111' }}>
                          <video
                            src={item.publicUrl}
                            preload="metadata"
                            muted
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(0,0,0,0.3)',
                            }}
                          >
                            <span style={{ color: '#fff' }}>
                              <AIcon name="play" size={40} />
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Status Badges */}
                      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                        <Badge status={isPublished ? 'completed' : 'draft'}>
                          {isPublished ? 'PUBLISHED' : 'HIDDEN'}
                        </Badge>
                        <Badge status="in_progress">{item.mediaType}</Badge>
                      </div>

                      {item.category && (
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px' }}>
                          <span className="ad-media-cat-pill" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {item.category}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta & Info */}
                    <div className="ad-video-card-body" style={{ padding: '16px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 6px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || item.originalFileName}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 10px 0' }}>
                        {formatBytes(item.sizeBytes)} · Added {fmtDateTime(item.createdAt)}
                      </p>

                      {/* Actions */}
                      <div className="ad-video-card-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`ad-btn ad-btn--sm ${isPublished ? 'ad-btn--ghost' : 'ad-btn--primary'}`}
                          disabled={isBusy}
                          onClick={() => handleToggleMediaStatus(item)}
                        >
                          <AIcon name={isPublished ? 'eyeOff' : 'check'} size={14} />
                          <span>{isPublished ? 'Hide' : 'Publish'}</span>
                        </button>

                        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                          <button
                            type="button"
                            className="ad-btn ad-btn--ghost ad-btn--sm"
                            disabled={isBusy || index === 0}
                            onClick={() => handleReorderMedia(item, 'UP')}
                            title="Move Up"
                          >
                            <AIcon name="arrowUp" size={14} />
                          </button>
                          <button
                            type="button"
                            className="ad-btn ad-btn--ghost ad-btn--sm"
                            disabled={isBusy || index === filteredMedia.length - 1}
                            onClick={() => handleReorderMedia(item, 'DOWN')}
                            title="Move Down"
                          >
                            <AIcon name="arrowDown" size={14} />
                          </button>
                          <button
                            type="button"
                            className="ad-btn ad-btn--danger ad-btn--sm"
                            disabled={isBusy}
                            onClick={() => setDeletingMedia(item)}
                            title="Delete"
                          >
                            <AIcon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          VIEW MODE 2: INSTAGRAM EMBEDS
          ========================================================================= */}
      {viewMode === 'INSTAGRAM' && (
        <>
          <div className="ad-filter-bar" style={{ marginBottom: '20px' }}>
            <Segmented
              label="Filter Videos"
              options={[
                { value: 'ALL', label: `All (${videos.length})` },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'HIDDEN', label: 'Hidden' },
              ]}
              value={videoFilter}
              onChange={(v) => setVideoFilter(v as VideoFilter)}
            />
          </div>

          {videoLoading && <Loading rows={3} />}
          {videoError && <ErrorNote error={videoError} onRetry={loadVideos} />}

          {!videoLoading && !videoError && videos.length === 0 && (
            <Empty
              title="No Instagram posts added"
              text="Curate your public Instagram posts or Reels by pasting their URL."
              action={
                <button type="button" className="ad-btn ad-btn--primary" onClick={() => setAddVideoOpen(true)}>
                  <AIcon name="plus" />
                  <span>Add First Instagram Post</span>
                </button>
              }
            />
          )}

          {!videoLoading && !videoError && videos.length > 0 && (
            <div className="ad-gallery-video-grid">
              {videos
                .filter((v) => videoFilter === 'ALL' || v.status === videoFilter)
                .map((item, index, filteredVideos) => {
                  const isPublished = item.status === 'PUBLISHED';
                  const isBusy = busyId === item.id;
                  return (
                    <Card key={item.id} className="ad-video-card">
                      <div className="ad-video-card-thumb" style={{ minHeight: '340px' }}>
                        <InstagramEmbed url={item.instagramUrl} captioned={false} />
                      </div>
                      <div className="ad-video-card-body" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          <Badge status={isPublished ? 'completed' : 'draft'}>{item.status}</Badge>
                          <Badge status="upcoming">{item.postType}</Badge>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                          Added {fmtDateTime(item.createdAt)}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`ad-btn ad-btn--sm ${isPublished ? 'ad-btn--ghost' : 'ad-btn--primary'}`}
                            disabled={isBusy}
                            onClick={() => handleToggleVideoStatus(item)}
                          >
                            <AIcon name={isPublished ? 'eyeOff' : 'check'} size={14} />
                            <span>{isPublished ? 'Hide' : 'Publish'}</span>
                          </button>

                          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                            <button
                              type="button"
                              className="ad-btn ad-btn--ghost ad-btn--sm"
                              disabled={isBusy || index === 0}
                              onClick={() => handleReorderVideo(item, 'UP')}
                              title="Move Up"
                            >
                              <AIcon name="arrowUp" size={14} />
                            </button>
                            <button
                              type="button"
                              className="ad-btn ad-btn--ghost ad-btn--sm"
                              disabled={isBusy || index === filteredVideos.length - 1}
                              onClick={() => handleReorderVideo(item, 'DOWN')}
                              title="Move Down"
                            >
                              <AIcon name="arrowDown" size={14} />
                            </button>
                            <button
                              type="button"
                              className="ad-btn ad-btn--danger ad-btn--sm"
                              disabled={isBusy}
                              onClick={() => setDeletingVideo(item)}
                              title="Delete"
                            >
                              <AIcon name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          MODAL 1: UPLOAD TO CLOUDFLARE R2
          ========================================================================= */}
      {uploadModalOpen && (
        <Modal open={uploadModalOpen} title="Upload Media to Cloudflare R2" onClose={closeUploadModal}>
          <form onSubmit={handleUploadSubmit} className="ad-form">
            {/* Upload Type Switch */}
            <div style={{ marginBottom: '16px' }}>
              <Segmented
                label="Select Upload Type"
                options={[
                  { value: 'IMAGE', label: 'Image Upload (JPG, PNG, WEBP)' },
                  { value: 'VIDEO', label: 'Video Upload (MP4, WebM)' },
                ]}
                value={uploadType}
                onChange={(v) => {
                  setUploadType(v as MediaType);
                  cleanupPreviewUrls();
                  setSelectedFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            </div>

            {/* File Picker */}
            <Field
              label={uploadType === 'IMAGE' ? 'Select Image(s)' : 'Select Video File'}
              hint={
                uploadType === 'IMAGE'
                  ? 'Supported: JPG, PNG, WEBP, SVG (up to 10 MB each). Multiple selection supported.'
                  : 'Supported: MP4, WebM (up to 100 MB). Uploads directly to Cloudflare R2.'
              }
            >
              {(p) => (
                <input
                  {...p}
                  ref={fileInputRef}
                  type="file"
                  className="ad-input"
                  multiple={uploadType === 'IMAGE'}
                  accept={
                    uploadType === 'IMAGE'
                      ? 'image/jpeg,image/png,image/webp,image/svg+xml'
                      : 'video/mp4,video/webm,video/quicktime'
                  }
                  onChange={handleFileChange}
                />
              )}
            </Field>

            {/* LIVE PREVIEW (PHASE 5 FIX: Native Image & Native HTML Video Player) */}
            {selectedFiles.length > 0 && previewUrls.length > 0 && (
              <div
                className="ad-preview-box"
                style={{
                  margin: '16px 0',
                  padding: '12px',
                  background: '#f9f6f3',
                  borderRadius: '8px',
                  border: '1px solid #e8ded4',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: '#7a1830' }}>
                  Live Preview ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected)
                </div>

                {uploadType === 'IMAGE' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                    {previewUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '4px', overflow: 'hidden', height: '90px' }}>
                        <img
                          src={url}
                          alt="Live Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ borderRadius: '6px', overflow: 'hidden', background: '#000' }}>
                    <video
                      src={previewUrls[0]}
                      controls
                      playsInline
                      style={{ width: '100%', maxHeight: '240px', display: 'block' }}
                    />
                  </div>
                )}

                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
                  {selectedFiles.map((f) => `${f.name} (${formatBytes(f.size)})`).join(', ')}
                </div>
              </div>
            )}

            {/* Optional Title */}
            <Field label="Media Title (optional)" hint="Descriptive headline for the gallery card">
              {(p) => (
                <input
                  {...p}
                  type="text"
                  className="ad-input"
                  placeholder="e.g. Bridal Half-Up Styling"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  maxLength={100}
                />
              )}
            </Field>

            {/* Category for Images */}
            {uploadType === 'IMAGE' && (
              <Field label="Category" hint="Choose the beauty discipline for gallery filtering">
                {(p) => (
                  <select {...p} className="ad-input" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}

            {/* Publishing Status */}
            <Field label="Initial Visibility Status" hint="Decide whether visitors see this immediately">
              {() => (
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="uploadStatus"
                      checked={uploadStatus === 'PUBLISHED'}
                      onChange={() => setUploadStatus('PUBLISHED')}
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="uploadStatus"
                      checked={uploadStatus === 'HIDDEN'}
                      onChange={() => setUploadStatus('HIDDEN')}
                    />
                    <span>Save as Hidden / Draft</span>
                  </label>
                </div>
              )}
            </Field>

            {/* Progress Bar */}
            {uploadProgress !== null && (
              <div style={{ margin: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>Uploading to Cloudflare R2...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      background: '#7a1830',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {uploadFormError && <div className="ad-form-error" style={{ color: '#d32f2f', margin: '8px 0', fontSize: '0.85rem' }}>{uploadFormError}</div>}

            <div className="ad-form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="ad-btn ad-btn--ghost" onClick={closeUploadModal} disabled={uploadProgress !== null}>
                Cancel
              </button>
              <button
                type="submit"
                className="ad-btn ad-btn--primary"
                disabled={!selectedFiles.length || uploadProgress !== null}
              >
                <AIcon name="plus" />
                <span>{uploadProgress !== null ? 'Uploading...' : 'Upload & Save'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 2: ADD INSTAGRAM EMBED
          ========================================================================= */}
      {addVideoOpen && (
        <Modal open={addVideoOpen} title="Add Instagram Video Post" onClose={closeAddVideoModal}>
          <form onSubmit={handleAddVideoSubmit} className="ad-form">
            <Field label="Instagram URL" hint="Paste a public Instagram Reel or video URL">
              {(p) => (
                <input
                  {...p}
                  type="url"
                  className="ad-input"
                  placeholder="https://www.instagram.com/reel/C8k1234abcd/"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  required
                />
              )}
            </Field>

            {urlParseResult && !urlParseResult.valid && (
              <div style={{ color: '#d32f2f', fontSize: '0.85rem', margin: '6px 0' }}>{urlParseResult.error}</div>
            )}

            {urlParseResult && urlParseResult.valid && (
              <div style={{ margin: '16px 0', padding: '12px', background: '#fcf8f2', borderRadius: '8px' }}>
                <InstagramEmbed url={urlParseResult.canonicalUrl} captioned={false} />
              </div>
            )}

            <Field label="Status">
              {() => (
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="postStatus"
                      checked={inputStatus === 'PUBLISHED'}
                      onChange={() => setInputStatus('PUBLISHED')}
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="postStatus"
                      checked={inputStatus === 'HIDDEN'}
                      onChange={() => setInputStatus('HIDDEN')}
                    />
                    <span>Save as Hidden</span>
                  </label>
                </div>
              )}
            </Field>

            {(videoFormError || action.error?.message) && (
              <div
                className="ad-form-error"
                style={{
                  color: '#d32f2f',
                  fontSize: '0.85rem',
                  padding: '8px 12px',
                  background: '#ffebee',
                  borderRadius: '6px',
                  margin: '10px 0',
                }}
              >
                {videoFormError || action.error?.message}
              </div>
            )}

            <div className="ad-form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="ad-btn ad-btn--ghost"
                onClick={() => {
                  setAddVideoOpen(false);
                  setVideoFormError(null);
                  action.setError(null);
                }}
                disabled={action.busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ad-btn ad-btn--ghost"
                disabled={!urlParseResult?.valid || action.busy}
                onClick={() => handleSaveVideo('HIDDEN')}
                title="Save video to gallery as hidden (draft)"
              >
                <span>Save as Hidden</span>
              </button>
              <button
                type="button"
                className="ad-btn ad-btn--primary"
                disabled={!urlParseResult?.valid || action.busy}
                onClick={() => handleSaveVideo('PUBLISHED')}
                title="Publish video directly to public gallery"
              >
                {action.busy ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <AIcon name="plus" />
                    <span>Publish Video</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 3: VIEW MEDIA LIGHTBOX
          ========================================================================= */}
      {viewingMedia && (
        <Modal open={!!viewingMedia} title={viewingMedia.title || viewingMedia.originalFileName} onClose={() => setViewingMedia(null)}>
          <div style={{ textAlign: 'center', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
            {viewingMedia.mediaType === 'IMAGE' ? (
              <img
                src={viewingMedia.publicUrl}
                alt={viewingMedia.title || viewingMedia.originalFileName}
                style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }}
              />
            ) : (
              <video
                src={viewingMedia.publicUrl}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', maxHeight: '70vh', display: 'block' }}
              />
            )}
          </div>
          <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#555' }}>
            <p><strong>Storage Key:</strong> {viewingMedia.storageKey}</p>
            <p><strong>Public URL:</strong> <a href={viewingMedia.publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7a1830' }}>{viewingMedia.publicUrl}</a></p>
            <p><strong>File Size:</strong> {formatBytes(viewingMedia.sizeBytes)} · <strong>MIME:</strong> {viewingMedia.mimeType}</p>
          </div>
        </Modal>
      )}

      {/* Confirm Deletion Modals */}
      {deletingMedia && (
        <Confirm
          open={!!deletingMedia}
          title="Delete Media from Cloudflare R2?"
          text={`Are you sure you want to permanently delete "${deletingMedia.originalFileName}"? This will delete the object from Cloudflare R2 and remove its metadata. This action cannot be undone.`}
          confirmLabel="Delete Media"
          danger
          busy={busyId === deletingMedia.id}
          onConfirm={handleDeleteMediaConfirm}
          onClose={() => setDeletingMedia(null)}
        />
      )}

      {deletingVideo && (
        <Confirm
          open={!!deletingVideo}
          title="Delete Instagram Post?"
          text="Remove this Instagram video post from your gallery?"
          confirmLabel="Delete Post"
          danger
          busy={busyId === deletingVideo.id}
          onConfirm={handleDeleteVideoConfirm}
          onClose={() => setDeletingVideo(null)}
        />
      )}
    </div>
  );
}
