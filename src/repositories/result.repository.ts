import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import { ResultDocument, CreateResultDTO, UpdateResultDTO } from '../types/result.types.js';

export class ResultRepository {
  private static COLLECTION_NAME = 'results';

  private static get collection(): Collection<ResultDocument> {
    return getDB().collection<ResultDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateResultDTO): Promise<ResultDocument> {
    const now = new Date();
    const doc: ResultDocument = {
      ...data,
      matchId: typeof data.matchId === 'string' ? new ObjectId(data.matchId) : data.matchId,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<ResultDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findByMatchId(matchId: string | ObjectId): Promise<ResultDocument | null> {
    const objectId = typeof matchId === 'string' ? new ObjectId(matchId) : matchId;
    return this.collection.findOne({ matchId: objectId });
  }

  static async findAll(filter: Filter<ResultDocument> = {}): Promise<ResultDocument[]> {
    return this.collection.find(filter).sort({ matchDate: -1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<ResultDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<ResultDocument[]> {
    const sort = options.sort || { matchDate: -1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<ResultDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async findRecent(limit = 5): Promise<ResultDocument[]> {
    return this.collection.find().sort({ matchDate: -1 }).limit(limit).toArray();
  }

  static async update(id: string | ObjectId, data: UpdateResultDTO): Promise<ResultDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<ResultDocument> = { ...data };
    if (data.matchId && typeof data.matchId === 'string') {
      updateData.matchId = new ObjectId(data.matchId);
    }

    const updateDoc: UpdateFilter<ResultDocument> = {
      $set: {
        ...updateData,
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
