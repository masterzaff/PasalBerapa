import { decryptMapping } from "@/lib/crypto";
import { unmaskMessages } from "@/lib/pii";

/**
 * Turn a stored conversation back into session state.
 *
 * Everything on the server is masked or encrypted, so this is where it becomes
 * readable again — decrypt the mapping, then unmask the messages with it.
 *
 * A missing or unusable key (locked session, different device, wrong password)
 * yields an empty mapping, and the conversation renders as <PERSON_1> tags.
 * That is the intended degraded state, not an error: the data is intact, it
 * just cannot be read here. `locked` says which case this is so the UI can
 * offer to unlock rather than silently showing tags.
 */
export async function hydrateConversation(d, encKey) {
  const hasSecrets = Boolean(d?.pii_mapping_enc);
  const mapping = hasSecrets && encKey ? await decryptMapping(encKey, d.pii_mapping_enc) : null;

  return {
    id: d.id,
    title: d.title,
    docName: d.doc_name,
    messages: unmaskMessages(d.messages || [], mapping || {}),
    maskedText: d.masked_text || "",
    piiMapping: mapping || {},
    locked: hasSecrets && !mapping,
  };
}
