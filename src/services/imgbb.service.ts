import { env } from '../config/env.js';

export interface ImgBBUploadResult {
  imageUrl: string;
  deleteUrl?: string;
  displayUrl?: string;
}

export class ImgBBService {
  private static readonly IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

  /**
   * Upload an image file buffer to the official ImgBB API.
   *
   * @param fileBuffer - Raw binary buffer of the image
   * @param fileName - Optional file name
   * @returns Object containing the uploaded image URL
   */
  static async uploadImage(
    fileBuffer: Buffer,
    fileName?: string
  ): Promise<ImgBBUploadResult> {
    const apiKey = env.IMGBB_API_KEY?.trim();

    if (!apiKey) {
      const error = new Error('ImgBB API key is not configured on the server') as Error & {
        statusCode: number;
      };
      error.statusCode = 503;
      throw error;
    }

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', fileBuffer.toString('base64'));

    if (fileName) {
      const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      formData.append('name', sanitized);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    try {
      const response = await fetch(ImgBBService.IMGBB_API_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        status?: number;
        data?: {
          url?: string;
          display_url?: string;
          delete_url?: string;
        };
        error?: {
          message?: string;
          code?: number;
        };
      } | null;

      if (!response.ok || !json || !json.success || !json.data?.url) {
        const errorMsg =
          json?.error?.message || `ImgBB API responded with HTTP status ${response.status}`;
        console.error('[ImgBBService] Upload failed:', errorMsg);
        const error = new Error(`Image upload failed: ${errorMsg}`) as Error & {
          statusCode: number;
        };
        error.statusCode = response.status >= 500 ? 502 : 400;
        throw error;
      }

      const imageUrl = json.data.display_url || json.data.url;

      return {
        imageUrl,
        displayUrl: json.data.display_url,
        deleteUrl: json.data.delete_url,
      };
    } catch (err: unknown) {
      if ((err as Error & { statusCode?: number }).statusCode) {
        throw err;
      }
      if ((err as Error).name === 'AbortError') {
        const timeoutError = new Error(
          'Image upload timed out while connecting to ImgBB'
        ) as Error & { statusCode: number };
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      console.error('[ImgBBService] Network error during upload:', (err as Error).message);
      const networkError = new Error(
        'Failed to reach image upload service. Please try again later.'
      ) as Error & { statusCode: number };
      networkError.statusCode = 502;
      throw networkError;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
