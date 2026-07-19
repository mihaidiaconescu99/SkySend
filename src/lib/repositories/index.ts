

export { BaseRepository } from "@/lib/repositories/base-repository";
export { isNotFound, mapPostgresError } from "@/lib/repositories/errors";
export {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBTableName,
  type DBUpdate,
  type RepositoryErrorCode,
  type RepositoryResult,
} from "@/lib/repositories/types";
