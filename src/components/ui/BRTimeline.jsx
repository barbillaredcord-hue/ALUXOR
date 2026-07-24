import { classNames } from '../../design/utils/theme';

export default function BRTimeline({ items = [], activeId, className = '', ...props }) {
  return (
    <ol className={classNames('br-timeline', className)} {...props}>
      {items.map((item, index) => {
        const key = item.id ?? index;
        const state =
          item.state || (activeId !== undefined && item.id === activeId ? 'active' : 'pending');

        return (
          <li className={classNames('br-timeline__item', `br-timeline__item--${state}`)} key={key}>
            <span className="br-timeline__marker" aria-hidden="true" />
            <div>
              <strong>{item.title}</strong>
              {item.description ? <p>{item.description}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
