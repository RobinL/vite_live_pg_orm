import { useEffect, useRef } from 'react';

export default function IndeterminateCheckbox({
    state,
    onChange,
}: { state: 'all' | 'some' | 'none'; onChange: () => void }) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = state === 'some';
    }, [state]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={state === 'all'}
            aria-checked={state === 'some' ? 'mixed' : state === 'all' ? 'true' : 'false'}
            onChange={(e) => { e.stopPropagation(); onChange(); }}
            className="accent-slate-700"
        />
    );
}
