interface DateLineProps {
  greg: string;
  hijri: string;
}

export function DateLine({ greg, hijri }: DateLineProps) {
  return (
    <div className="dateline">
      <b>{greg}</b>
      <span className="dot" />
      <span className="hijri">{hijri}</span>
    </div>
  );
}
