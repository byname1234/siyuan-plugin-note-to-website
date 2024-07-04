# NoteToWebsite

# [中文](./README_zh_CN.md)

## 🌟 Features

1. Convert the currently open note into a static website, including sub-notes;

2. The website generation engine is [Mkdoc](https://www.mkdocs.org/), theme is [mkdocs-material](https://squidfunk.github.io/mkdocs-material/);

3. Hyperlinks, references, and attached resources in the notes can all be processed;

4. Support for customizing website name, logo, favicon, and other content;

## 🤔 How to use

1. Open the note that needs to be converted into a website, and ensure that the note tab is selected;

2. Click on the plugin logo in the top left corner, then click on "Generate Website" to start the generation process. After the generation is complete, the directory containing the website will automatically open; 

3. It is recommended to organize notes in a hierarchical structure similar to a book's table of contents. This way, the generated website will resemble an e-book or document, making it easier for visitors to navigate and read;
   ```
   Notebook1
     |
     |-- noteXX
           |-- 1 AA
           |-- 2 BB
                |-- 2.1 BB-1
                |-- 2.2 BB-2
           |-- 3 CC
   ```

## 🚨 Precautions to note

1. When generating the website, the root note will be processed into index.html, and parent notes will be treated as "directories", with the content of the parent notes not reflected in the website;

2. Do not use first-level headings in the note content. The highest-level heading should start from the second level. Otherwise, this plugin will treat the first first-level heading as the note title;
   
3. Do not use Markdown syntax characters (e.g., `#`, `*`) in note names. Otherwise, references or links pointing to the note name may become invalid after being processed into HTML; 

4. The website directory tree is sorted in ascending order based on the chapter numbers in front of each note name; 
   1. Chapter numbers and chapter names should be separated by a character, such as a space. If not separated, the plugin may not be able to distinguish between the number and the chapter content, which may result in unexpected sorting results. It is recommended to use a space between Arabic numerals and chapter names, and use a comma or space between Chinese numerals and chapter names. For example:  
   `1.1.1 XXXXXX` `1-1-1 XXXXXX` `一、XXXXXX` `一 XXXXXX`

   2. Chapter names must start with a number (Arabic numeral, Chinese numeral). Notes whose starting characters cannot be recognized will be sorted at the very beginning. For example: `<1.1.1> XXXXXX` `【一】XXXXXX`;

## 📝 Support for note elements

- block 
  - *✅️ heading(H2~H6);*
  - *❌ heading(H1);*
  - *✅ ordered list、unordered list;*
  - *❌ task list;*
  - *✅ blockquote;*
  - *✅ code block;*
  - *✅ table;*
  - *✅ horizontal rule;*
  - *❌ block-level formula;*
  - *✅ HTML block;*
  - *✅ reference;*
- content format
  - *✅ emoji, bold, italic, underline;*
  - *✅ inline space;*
  - *❌ leading space, trailing space;*
  - *❌ header image;*
  - *❌ header icon;*
  - *❌ space in table;*
  - *❌ strikethrough;*
  - *❌ mark;*
  - *❌ tag;*
  - *✅ superscript, subscript;*
  - *✅ inline code;*
  - *❌ inline formula;*
- resource 
  - local resource 
    - *✅ image, video, file attachment;*
  - remote resource 
    - *✅ IFrame link, image link, video link, audio link;*
- style 
  - *❌ info style, success style, warning style, error style;* 
- special content
  - *❌ widget;*
  - *❌ database;*
  - *❌ embed block;*
  - *❌ super block;*
- expanded content
  - *❌ Staff;*
  - *❌ Chart;*
  - *❌ Flow Chart;*
  - *❌ Graphviz;*
  - *❌ Mermaid;*
  - *❌ MindMap;*
  - *❌ PlantUML;*

## 📚 FAQ

1. Error when generating the website: Could not find a version ...

    👉 Check if a network proxy is enabled. Disable the proxy and try again; 

2. After transferring a note from the current notebook to another notebook, the generated website content is partially missing.

    👉 Try again after selecting "Rebuild Index" in the document tree;

## 🐞 Issue

To report bugs or other issues, click [here](https://github.com/byname1234/siyuan-plugin-note-to-website/issues) to start a discussion.
