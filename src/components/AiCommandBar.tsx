import { quickPrompts } from '../data/dashboard';
import { Icon } from './Icon';

interface AiCommandBarProps {
  placeholder?: string;
  showPrompts?: boolean;
}

export function AiCommandBar({
  placeholder = '询问 LinZight AI，例如：“查看本季度患者入组趋势”',
  showPrompts = true
}: AiCommandBarProps) {
  return (
    <>
      <div className="ai-bar" role="search">
        <div className="ai-bar__icon">
          <Icon name="sparkles" />
        </div>
        <input
          aria-label="询问 LinZight AI"
          type="text"
          placeholder={placeholder}
        />
        <div className="ai-bar__actions">
          <button className="ai-bar__button ai-bar__button--send" type="button" aria-label="发送提示词">
            <Icon name="send" />
          </button>
        </div>
      </div>

      {showPrompts && (
        <div className="quick-chips" aria-label="AI 提示示例">
          {quickPrompts.map((prompt) => (
            <button className="chip" key={prompt.label} type="button">
              <Icon name={prompt.icon} />
              <span>{prompt.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
