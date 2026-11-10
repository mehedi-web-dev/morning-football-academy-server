import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import {
  RegistrationDocument,
  CreateRegistrationDTO,
  UpdateRegistrationDTO,
  RegistrationStatus,
} from '../types/registration.types.js';

export class RegistrationRepository {
  private static COLLECTION_NAME = 'registrations';

  private static get collection(): Collection<RegistrationDocument> {
    return getDB().collection<RegistrationDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateRegistrationDTO): Promise<RegistrationDocument> {
    const now = new Date();
    const doc: RegistrationDocument = {
      ...data,
      status: data.status || 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<RegistrationDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findByEmail(email: string): Promise<RegistrationDocument[]> {
    return this.collection.find({ email }).sort({ createdAt: -1 }).toArray();
  }

  static async findByStatus(status: RegistrationStatus): Promise<RegistrationDocument[]> {
    return this.collection.find({ status }).sort({ createdAt: -1 }).toArray();
  }

  static async findAll(filter: Filter<RegistrationDocument> = {}): Promise<RegistrationDocument[]> {
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<RegistrationDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<RegistrationDocument[]> {
    const sort = options.sort || { createdAt: -1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<RegistrationDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async updateStatus(id: string | ObjectId, status: RegistrationStatus): Promise<RegistrationDocument | null> {
    return this.update(id, { status });
  }

  static async update(id: string | ObjectId, data: UpdateRegistrationDTO): Promise<RegistrationDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateDoc: UpdateFilter<RegistrationDocument> = {
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
