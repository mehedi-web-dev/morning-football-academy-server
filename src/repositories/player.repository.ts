import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import { PlayerDocument, CreatePlayerDTO, UpdatePlayerDTO } from '../types/player.types.js';

export class PlayerRepository {
  private static COLLECTION_NAME = 'players';

  private static get collection(): Collection<PlayerDocument> {
    return getDB().collection<PlayerDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreatePlayerDTO): Promise<PlayerDocument> {
    const now = new Date();
    const doc: PlayerDocument = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<PlayerDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findBySlug(slug: string): Promise<PlayerDocument | null> {
    return this.collection.findOne({ slug });
  }

  static async findAll(filter: Filter<PlayerDocument> = {}): Promise<PlayerDocument[]> {
    return this.collection.find(filter).sort({ jerseyNumber: 1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<PlayerDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<PlayerDocument[]> {
    const sort = options.sort || { jerseyNumber: 1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<PlayerDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async findActive(): Promise<PlayerDocument[]> {
    return this.collection.find({ isActive: true }).sort({ jerseyNumber: 1 }).toArray();
  }

  static async update(id: string | ObjectId, data: UpdatePlayerDTO): Promise<PlayerDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateDoc: UpdateFilter<PlayerDocument> = {
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
