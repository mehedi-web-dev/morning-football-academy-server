import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import { GalleryDocument, CreateGalleryDTO, UpdateGalleryDTO } from '../types/gallery.types.js';

export class GalleryRepository {
  private static COLLECTION_NAME = 'gallery';

  private static get collection(): Collection<GalleryDocument> {
    return getDB().collection<GalleryDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateGalleryDTO): Promise<GalleryDocument> {
    const now = new Date();
    const doc: GalleryDocument = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<GalleryDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findAll(filter: Filter<GalleryDocument> = {}): Promise<GalleryDocument[]> {
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<GalleryDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<GalleryDocument[]> {
    const sort = options.sort || { createdAt: -1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<GalleryDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async findPublished(category?: string): Promise<GalleryDocument[]> {
    const filter: Filter<GalleryDocument> = { isPublished: true };
    if (category) {
      filter.category = category;
    }
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async findByCategory(category: string): Promise<GalleryDocument[]> {
    return this.collection.find({ category }).sort({ createdAt: -1 }).toArray();
  }

  static async update(id: string | ObjectId, data: UpdateGalleryDTO): Promise<GalleryDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateDoc: UpdateFilter<GalleryDocument> = {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    };
    return this.collection.findOneAndUpdate(
      { _id: objectId },
      updateDoc,
      { returnDocument: 'after' }
    );
  }

  static async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }
}
