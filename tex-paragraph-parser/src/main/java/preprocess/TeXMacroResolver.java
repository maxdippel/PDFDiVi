package preprocess;

import static model.TeXParagraphParserSettings.TEX_ELEMENT_REFERENCES_PATH;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import de.freiburg.iif.collection.ConstantLookupList;
import model.Command;
import model.Document;
import model.Element;
import model.Group;
import model.MacroDefinition;
import model.Marker;
import model.NewLine;
import model.NewParagraph;
import model.TeXElementReference;
import model.TeXElementReferences;
import model.Text;
import model.Whitespace;
import parse.ParseException;
import parse.TeXParser;

/**
 * Class that resolves all macros in tex files.
 *
 * @author Claudius Korzen
 */
public class TeXMacroResolver extends TeXParser {
  /**
   * The number of consecutive whitespaces in front of the current element to
   * output.
   */
  protected int numConsecutiveWhitespaces;

  /**
   * The number of consecutive newlines in front of the current element to
   * output.
   */
  protected int numConsecutiveNewlines;

  /**
   * Flag that indicates, if the command "\end{document}" was already seen.
   */
  protected boolean isEndDocument;

  /**
   * The path to the command references file.
   */
  static final String COMMAND_REFERENCES_PATH = "/command-references.csv";

  /**
   * The field separator on command references file.
   */
  static final String COMMAND_REFERENCES_SEPARATOR = ",";

  protected TeXElementReferences refs;

  /**
   * Creates a macro resolver for the given tex file.
   * 
   * @throws IOException
   */
  public TeXMacroResolver(InputStream stream) throws IOException {
    super(stream);
    this.refs = new TeXElementReferences(TEX_ELEMENT_REFERENCES_PATH);
  }

  /**
   * Resolves the macros for the tex file and writes the result to given target
   * path.
   */
  public void resolveMacros(Path target) throws IOException, ParseException {
    ensureFileExistency(target);
    try (BufferedWriter w =
        Files.newBufferedWriter(target, StandardCharsets.UTF_8)) {
      preprocess(w);
    }
  }

  /**
   * Starts the preprocessing for the given tex file and writes the result to
   * the given writer.
   */
  public void preprocess(BufferedWriter writer) throws IOException,
    ParseException {
    Document document = parse();
        
    while (document.hasNext()) {
      handleElement(document.next(), writer);
    }
  }

  /**
   * Handles the given element from parsed tex document.
   */
  protected void handleElement(Element element, BufferedWriter writer) {
    if (element instanceof MacroDefinition) {
      handleMacroDefinition((MacroDefinition) element, writer);
    } else if (element instanceof NewLine) {
      handleNewline((NewLine) element, writer);
    } else if (element instanceof Whitespace) {
      handleWhitespace((Whitespace) element, writer);
    } else if (element instanceof Command) {
      handleCommand((Command) element, writer);
    } else if (element instanceof Group) {
      handleGroup((Group) element, writer);
    } else if (element instanceof Text) {
      handleText((Text) element, writer);
    } else if (element instanceof Marker) {
      handleMarker((Marker) element, writer);
    }
  }

  /**
   * Handles the given macro definition.
   */
  public void handleMacroDefinition(Command command, BufferedWriter writer) {
    outputElement(command, writer);
  }

  /**
   * Handles the given command.
   */
  public void handleCommand(Command command, BufferedWriter writer) {
    outputElements(resolve(command), writer);
    if ("\\end{document}".equals(command.toString())) {
      isEndDocument = true;
    }
  }

  /**
   * Handles the given group.
   */
  public void handleGroup(Group group, BufferedWriter writer) {
    outputElements(resolve(group), writer);
  }

  /**
   * Handles the given text.
   */
  public void handleText(Text text, BufferedWriter writer) {
    outputElements(resolve(text), writer);
  }

  /**
   * Handles the given newline.
   */
  public void handleNewline(NewLine command, BufferedWriter writer) {
    outputElements(resolve(command), writer);
  }

  /**
   * Handles the given whitespace.
   */
  public void handleWhitespace(Whitespace command, BufferedWriter writer) {
    outputElements(resolve(command), writer);
  }

  /**
   * Handles the given marker.
   */
  public void handleMarker(Marker marker, BufferedWriter writer) {
    // Nothing to do.
  }

  // ___________________________________________________________________________

  /**
   * Resolves the given element.
   * 
   * @throws IOException
   */
  protected ConstantLookupList<Element> resolve(Element element) {
    Group group = new Group();
    resolveElement(element, group);
    return group.elements;
  }

  /**
   * Resolves the given command recursively.
   */
  protected void resolveElement(Element element, Group result) {
    if (element instanceof Group) {
      resolveGroup((Group) element, result);
    } else if (element instanceof Command) {
      resolveCommand((Command) element, result);
    } else {
      // Nothing to resolve here.
      result.addElement(element);
    }
  }

  /**
   * Resolves the given group.
   * 
   * @throws IOException
   */
  protected void resolveGroup(Group group, Group result) {
    if (group != null && group.elements != null) {
      // Resolve the elements of the group in own context.
      Group resolvedGroup = new Group();
      for (Element element : group.elements) {
        resolveElement(element, resolvedGroup);
      }
      // Update the elements of the group to the resolved ones.
      group.elements = resolvedGroup.elements;
    }
    result.addElement(group);
  }

  /**
   * Resolves the given command.
   */
  protected void resolveCommand(Command command, Group result) {
    if (command == null) {
      return;
    }

    // Check, if the command was defined via a macro.
    if (isDefinedByMacro(command)) {
      // Resolve the macro.
      Group macro = getMacro(command).clone();

      // Plug in the arguments (replace the markers by arguments).
      List<Marker> markers = macro.get(Marker.class, true);
      for (Marker marker : markers) {
        if (marker != null && command.hasGroups(marker.getId())) {
          Group arg = command.getGroup(marker.getId());
          if (arg != null) {
            macro.replace(marker, arg.trimmedElements);
          }
        }
      }

      // Resolve the elements of the macro.
      for (Element element : macro.elements) {
        element.setBeginColumnNumber(command.getBeginColumnNumber());
        element.setEndColumnNumber(command.getEndColumnNumber());
        element.setBeginLineNumber(command.getBeginLineNumber());
        element.setEndLineNumber(command.getEndLineNumber());

        resolveElement(element, result);
      }
      // Append a whitespace after a macro.
      // result.addElement(new Whitespace(
      // command.getBeginLineNumber(),
      // command.getEndLineNumber(),
      // command.getBeginColumnNumber(),
      // command.getEndColumnNumber()));

    } else {
      // Command is not a macro, resolve its groups.
      for (Group group : command.getGroups()) {
        resolve(group);
      }
      result.addElement(command);
    }
  }

  // ___________________________________________________________________________

  /**
   * Outputs the given list of elements to the given writer.
   */
  protected void outputElements(List<Element> elements, BufferedWriter w) {
    for (Element element : elements) {
      outputElement(element, w);
    }
  }

  protected Element prevNonWhitespace = null;

  /**
   * Outputs the given element to the given writer.
   */
  protected void outputElement(Element element, BufferedWriter writer) {
    if (element == null) {
      return;
    }

    // Don't output any elements, if the end of documents was reached.
    if (isEndDocument) {
      return;
    }

    if (element instanceof Whitespace) {
      // Register the whitespace and output it to the writer only if a
      // non-whitespace element follows.
      numConsecutiveWhitespaces++;
      return;
    } else if (element instanceof NewLine) {
      // On newline, we don't have to output any registered whitespace anymore.
      numConsecutiveWhitespaces = 0;
      numConsecutiveNewlines++;
      return;
    } else if (element instanceof NewParagraph) {
      // On newline, we don't have to output any registered whitespace anymore.
      numConsecutiveWhitespaces = 0;
      numConsecutiveNewlines += 2;
      return;
    }

    TeXElementReference prevRef = refs.getElementReference(prevNonWhitespace);
    TeXElementReference ref = refs.getElementReference(element);

    boolean prevEndsParagraph = prevRef != null && prevRef.endsParagraph();
    boolean startsParagraph = ref != null && ref.startsParagraph();
    int lineNum = element.getBeginLineNumber();
    int prevLineNum = -1;
    if (prevNonWhitespace != null) {
      prevLineNum = prevNonWhitespace.getBeginLineNumber();
    }

    try {
      // Make sure that new paragraphs starts in a new line.
      if ((prevEndsParagraph || startsParagraph) && (prevLineNum == lineNum)) {
        writer.write(new NewLine(null).toString());
      }

      // Check, if we have to introduce a whitespace.
      if (numConsecutiveWhitespaces > 0) {
        writer.write(new Whitespace(
            element.getBeginLineNumber(),
            element.getEndLineNumber(),
            element.getBeginColumnNumber(),
            element.getEndColumnNumber()).toString());
      }
      // Check, if we have to introduce a paragraph.
      if (numConsecutiveNewlines == 1) {
        writer.newLine();
      } else if (numConsecutiveNewlines > 1) {
        writer.newLine();
        writer.newLine();
      }

      writer.write(element.toString());
    } catch (IOException e) {
      System.err.print("Couldn't write to the writer: " + e.getMessage());
    } finally {
      // Unregister the whitespace and the newparagraph.
      numConsecutiveWhitespaces = 0;
      numConsecutiveNewlines = 0;
    }

    prevNonWhitespace = element;
  }

  // ___________________________________________________________________________

  /**
   * Creates the given file if it doesn't exist yet.
   */
  protected void ensureFileExistency(Path file) throws IOException {
    if (!Files.exists(file)) {
      Files.createDirectories(file.getParent());
      Files.createFile(file);
    }
  }

  /**
   * Returns true, if the given command is defined by a macro.
   */
  protected boolean isDefinedByMacro(Command command) {
    return macros.containsKey(command.getName());
  }

  /**
   * Returns the macro definition for the given command.
   */
  protected Group getMacro(Command command) {
    return macros.get(command.getName());
  }
}
