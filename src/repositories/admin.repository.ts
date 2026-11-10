import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import { AdminDocument, CreateAdminDTO, UpdateAdminDTO } from '../types/admin.types.js';

export class AdminRepository {
  private static COLLECTION_NAME = 'admins';

  private static get collection(): Collection<AdminDocument> {
    return getDB().collection<AdminDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateAdminDTO): Promise<AdminDocument> {
    const now = new Date();
    const doc: AdminDocument = {
      ...data,
      email: data.email.toLowerCase().trim(),
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<AdminDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.collection.findOne({ email: email.toLowerCase().trim() });
  }

  static async findAll(filter: Filter<AdminDocument> = {}): Promise<AdminDocument[]> {
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async update(id: string | ObjectId, data: UpdateAdminDTO): Promise<AdminDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<AdminDocument> = { ...data };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    const updateDoc: UpdateFilter<AdminDocument> = {
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
