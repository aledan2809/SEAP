/**
 * Tipuri pentru integrarea cu SEAP (e-licitatie.ro)
 */

export interface SeapTender {
  id: string;
  numarAnunt: string;
  titluContract: string;
  descriere?: string;

  // Autoritate contractantă
  autoritateContractanta: {
    denumire: string;
    cui?: string;
    adresa?: string;
    localitate?: string;
    judet?: string;
  };

  // Valoare
  valoareEstimata?: number;
  moneda: string;

  // Clasificare
  cpvCodePrincipal: string;
  cpvCoduriSecundare?: string[];
  cpvDescriere?: string;

  // Tip procedură
  tipProcedura: string;
  tipContract: string; // furnizare, servicii, lucrari

  // Termene
  dataPublicare: string;
  dataLimitaDepunere?: string;
  dataDeschidere?: string;

  // Link
  linkAnunt: string;

  // Documente atașate
  documente?: SeapDocument[];
}

export interface SeapDocument {
  id: string;
  denumire: string;
  tipDocument: string;
  dataIncarcare: string;
  dimensiune?: number;
  linkDescarcare: string;
}

export interface SeapSearchParams {
  cpvCodes?: string[];
  keywords?: string[];
  valoareMin?: number;
  valoareMax?: number;
  tipProcedura?: string[];
  judet?: string[];
  dataPublicareDe?: string;
  dataPublicarePana?: string;
  tipContract?: string[];
  page?: number;
  pageSize?: number;
}

export interface SeapSearchResult {
  total: number;
  page: number;
  pageSize: number;
  results: SeapTender[];
}

export interface SeapClarificare {
  id: string;
  tenderId: string;
  numar: number;
  intrebare: string;
  raspuns: string;
  dataPublicare: string;
  documente?: SeapDocument[];
}

/**
 * Status licitație în SEAP
 */
export type SeapTenderStatus =
  | 'in_desfasurare'    // Licitație activă
  | 'in_evaluare'        // Se evaluează ofertele
  | 'atribuita'          // Contract atribuit
  | 'anulata'            // Licitație anulată
  | 'finalizata';        // Procedură încheiată
