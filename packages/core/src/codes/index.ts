// Public surface for the codes domain. Generation primitives live in
// generate.ts so the bulk job module can depend on them without
// importing this barrel (which would re-create a cycle).
export {
  generateCode,
  generateReferralCode,
  generateUniqueCodes,
  type CodeConfig,
} from "./generate.ts";
export { BULK_INLINE_THRESHOLD, bulkGenerateCodes, type BulkCodesPayload } from "./bulk-job.ts";
