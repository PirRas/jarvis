import "katex/dist/katex.min.css";
import { Children, isValidElement, type ReactElement } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Diagram, Structure, WikiImage } from "./Diagram";

const PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/";

// Markdown erlaubt keine Leerzeichen im Link, die KI schreibt aber "wiki:leaf cross section": vorher kodieren
const encodeTerms = (md: string) =>
  md.replace(/\]\((wiki|pubchem):([^)\n]+)\)/g, (_, scheme, term) => `](${scheme}:${encodeURIComponent(term.trim())})`);

// Schon gespeicherte Vorlesungen: "\text" kam als Tab + "ext" an, "\frac" als Formfeed + "rac" usw. (siehe parseClaudeJson)
const CTRL: Record<string, string> = { "\b": "b", "\f": "f", "\r": "r", "\t": "t" };
const restoreLatex = (md: string) =>
  md.replace(/[\b\f\r](?=[a-z])|\t(?=ext|imes|heta|au|ilde|riangle|o[^a-z])/g, (c) => "\\" + CTRL[c]);

// react-markdown verwirft unbekannte Protokolle: pubchem:<name> umschreiben, wiki:<begriff> durchlassen
const urlTransform = (url: string) =>
  url.startsWith("pubchem:")
    ? `${PUBCHEM}${url.slice(8)}/PNG?image_size=300x300`
    : url.startsWith("wiki:")
      ? url
      : defaultUrlTransform(url);

const components: Components = {
  pre({ children, ...rest }) {
    const code = Children.toArray(children)[0];
    if (isValidElement(code)) {
      const { className, children: text } = (code as ReactElement<{ className?: string; children?: string }>).props;
      if (className?.includes("language-mermaid")) return <Diagram code={String(text ?? "")} />;
    }
    return <pre {...rest}>{children}</pre>;
  },
  img({ src, alt }) {
    if (typeof src !== "string") return null;
    if (src.startsWith("wiki:")) return <WikiImage term={decodeURIComponent(src.slice(5))} alt={alt ?? ""} />;
    return src.startsWith(PUBCHEM) ? (
      <Structure src={src} alt={alt ?? ""} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- wie bisher: beliebige Markdown-Bilder
      <img src={src} alt={alt ?? ""} />
    );
  },
};

/** Markdown mit Tabellen, LaTeX-Formeln, Mermaid-Diagrammen und PubChem-Strukturformeln. */
export function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      urlTransform={urlTransform}
      components={components}
    >
      {encodeTerms(restoreLatex(children))}
    </ReactMarkdown>
  );
}
