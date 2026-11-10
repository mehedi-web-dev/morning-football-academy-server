import { ObjectId } from 'mongodb';

export type GalleryMediaType = 'image' | 'video';

export interface GalleryDocument {
  _id?: ObjectId;
  title: string;
  description?: string;
  mediaType: GalleryMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  category: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateGalleryDTO = Omit<GalleryDocument, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateGalleryDTO = Partial<CreateGalleryDTO>;
