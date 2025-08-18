export const stripSchema = (s: string) => s.replace(/^public\./i, '');
export const unquote = (s: string) => s.replace(/^"+|"+$/g, '');
export const normalize = (s: string) => unquote(stripSchema(s)).toLowerCase();

const simple = /^[a-z_][a-z0-9_]*$/;
export const needsQuote = (s: string) => !simple.test(s);
export const quoteIdent = (name: string): string => {
    const parts = name.split('.');
    const forceQuote = parts.length > 1; // quote all parts when dotted
    return parts
        .map(p => (forceQuote || needsQuote(p)) ? `"${p.replace(/"/g, '""')}"` : p)
        .join('.');
};
