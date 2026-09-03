-- Prompt 4: track content pieces by type and by founder.
alter type metric_key add value if not exists 'reels_published';
alter type metric_key add value if not exists 'articles_published';
