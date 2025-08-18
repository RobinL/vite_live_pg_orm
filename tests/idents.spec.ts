import { describe, it, expect } from 'vitest';
import { normalize, quoteIdent, needsQuote } from '../src/lib/idents';

describe('idents', () => {
    it('normalize strips schema/quotes and lowercases', () => {
        expect(normalize('public."Customers"')).toBe('customers');
        expect(normalize('"Weird.Name"')).toBe('weird.name'); // dots kept for quoting later
    });
    it('quoteIdent only quotes when needed', () => {
        expect(quoteIdent('customers')).toBe('customers');
        expect(quoteIdent('weird.name')).toBe('"weird"."name"');
        expect(needsQuote('customers')).toBe(false);
        expect(needsQuote('Order Details')).toBe(true);
    });
});
