import { youtubeMetadataService } from '../src/services/youtube-metadata.service';

describe('YouTubeMetadataService URL Extraction and Validation', () => {
  it('correctly extracts video IDs from standard youtube.com watch URLs', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const id = youtubeMetadataService.extractVideoId(url);
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('correctly extracts video IDs with additional query parameters', () => {
    const url = 'https://www.youtube.com/watch?feature=share&v=jNQXAC9IVRw&t=30s';
    const id = youtubeMetadataService.extractVideoId(url);
    expect(id).toBe('jNQXAC9IVRw');
  });

  it('correctly extracts video IDs from short youtu.be URLs', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const id = youtubeMetadataService.extractVideoId(url);
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('correctly extracts video IDs from YouTube Shorts URLs', () => {
    const url = 'https://www.youtube.com/shorts/5qap5aO4i9A';
    const id = youtubeMetadataService.extractVideoId(url);
    expect(id).toBe('5qap5aO4i9A');
  });

  it('correctly extracts video IDs from embed URLs', () => {
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    const id = youtubeMetadataService.extractVideoId(url);
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('rejects invalid or non-YouTube URLs', () => {
    expect(youtubeMetadataService.extractVideoId('https://vimeo.com/123456789')).toBeNull();
    expect(youtubeMetadataService.extractVideoId('https://notyoutube.com/watch?v=123')).toBeNull();
    expect(youtubeMetadataService.extractVideoId('')).toBeNull();
    expect(youtubeMetadataService.extractVideoId('random string')).toBeNull();
  });
});
