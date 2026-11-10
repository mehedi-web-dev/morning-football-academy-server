import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import { MatchDocument, CreateMatchDTO, UpdateMatchDTO, MatchStatus } from '../types/match.types.js';

export class MatchRepository {
  private static COLLECTION_NAME = 'matches';

  private static get collection(): Collection<MatchDocument> {
    return getDB().collection<MatchDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateMatchDTO): Promise<MatchDocument> {
    const now = new Date();
    const doc: MatchDocument = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<MatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findAll(filter: Filter<MatchDocument> = {}): Promise<MatchDocument[]> {
    return this.collection.find(filter).sort({ matchDate: -1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<MatchDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<MatchDocument[]> {
    const sort = options.sort || { matchDate: -1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<MatchDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async findUpcoming(limit = 5): Promise<MatchDocument[]> {
    return this.collection
      .find({
        status: 'upcoming',
        matchDate: { $gte: new Date() },
      })
      .sort({ matchDate: 1 })
      .limit(limit)
      .toArray();
  }

  static async findByStatus(status: MatchStatus): Promise<MatchDocument[]> {
    return this.collection.find({ status }).sort({ matchDate: -1 }).toArray();
  }

  static async update(id: string | ObjectId, data: UpdateMatchDTO): Promise<MatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateDoc: UpdateFilter<MatchDocument> = {
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
