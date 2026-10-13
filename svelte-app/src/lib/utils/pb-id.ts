import { customAlphabet } from "nanoid";

/**
 * Id au format PocketBase — exactement 15 caractères de [a-z0-9] (contrainte
 * serveur stricte : min=max=15, pattern ^[a-z0-9]+$). Transmis comme `id` à
 * create, il devient une clé d'idempotence : PocketBase préserve l'id client
 * et rejette (400 validation_not_unique) un second create portant le même.
 */
export const newPbId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 15);
