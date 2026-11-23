import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { sendError } from '../utils/apiResponse.js';

// Maximum allowed image file size: 5 MB
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5,242,880 bytes

// Allowed MIME types and extensions
export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
];

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validates file buffer header magic bytes against JPEG, PNG, and WebP signatures.
 */
export function validateImageMagicBytes(buffer: Buffer): {
  isValid: boolean;
  detectedFormat?: 'jpeg' | 'png' | 'webp';
} {
  if (!buffer || buffer.length < 12) {
    return { isValid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedFormat: 'jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedFormat: 'png' };
  }

  // WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { isValid: true, detectedFormat: 'webp' };
  }

  return { isValid: false };
}

// In-memory Multer instance
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (!ALLOWED_IMAGE_MIMES.includes(mime) || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      cb(
        new Error(
          'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
        )
      );
      return;
    }

    cb(null, true);
  },
});

/**
 * Express middleware for parsing and validating uploaded player images under field 'image'.
 */
export function handlePlayerImageUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const uploadSingle = upload.single('image');

  uploadSingle(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          sendError(res, 'File size exceeds 5MB limit', 400);
          return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          sendError(
            res,
            'Unexpected field. Image file must be uploaded under field "image"',
            400
          );
          return;
        }
        sendError(res, `Upload error: ${err.message}`, 400);
        return;
      }

      sendError(
        res,
        (err as Error).message || 'Invalid image file upload',
        400
      );
      return;
    }

    if (!req.file) {
      sendError(res, 'Image file is required under field "image"', 400);
      return;
    }

    // Deep inspection of magic bytes
    const inspection = validateImageMagicBytes(req.file.buffer);
    if (!inspection.isValid) {
      sendError(
        res,
        'Invalid image content. File header does not match valid JPEG, PNG, or WebP format.',
        400
      );
      return;
    }

    next();
  });
}
