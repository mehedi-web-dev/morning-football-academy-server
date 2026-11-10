import { ObjectId } from 'mongodb';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationDocument {
  _id?: ObjectId;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  position: string;
  experience: string;
  message?: string;
  status: RegistrationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateRegistrationDTO = Omit<RegistrationDocument, '_id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: RegistrationStatus;
};
export type UpdateRegistrationDTO = Partial<Omit<RegistrationDocument, '_id' | 'createdAt' | 'updatedAt'>>;
