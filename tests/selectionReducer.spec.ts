import { toggleSelectionReducer } from '../src/lib/selectionReducer';

describe('toggleSelectionReducer', () => {
    it('table.* removes individual cols', () => {
        const next = toggleSelectionReducer(['orders.order_id', 'orders.ship_name'], 'orders.*');
        expect(next).toEqual(['orders.*']);
    });
    it('column removes table.*', () => {
        const next = toggleSelectionReducer(['orders.*'], 'orders.order_id');
        expect(next).toEqual(['orders.order_id']);
    });
    it('toggle removes when already selected', () => {
        const next = toggleSelectionReducer(['orders.order_id'], 'orders.order_id');
        expect(next).toEqual([]);
    });
});
