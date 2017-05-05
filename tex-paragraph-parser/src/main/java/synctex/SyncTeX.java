package synctex;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

import identifier.PdfPageIdentifier;
import model.SyncTeXBoundingBox;
import model.TeXFile;

/**
 * Class to read the positions of lines from syntex files.
 * 
 * @author Claudius Korzen
 */
public class SyncTeX {
  /**
   * The tex file to process.
   */
  protected TeXFile texFile;
  
  /**
   * The synctex parser.
   */
  protected SyncTeXParser parser;
   
  /**
   * The default constructor.
   */
  public SyncTeX(TeXFile texFile) {
    this.texFile = texFile;
  }
  
  /**
   * Returns the bounding boxes of given line.
   */
  public List<SyncTeXBoundingBox> getBoundingBoxesOfLine(int lineNum) 
      throws IOException {
    if (this.parser == null) {
      // Lazy loading.
      Path synctexPath = texFile.getSynctexPath();
      PdfPageIdentifier pageIdentifier = new PdfPageIdentifier(texFile);
      this.parser = new SyncTeXParser(synctexPath, pageIdentifier);
    }
    return this.parser.getLineBoundingBoxes(lineNum);
  }
  
  /**
   * Returns the most common line height.
   */
  public float getMostCommonLineHeight() {
    if (this.parser == null) {
      // Lazy loading.
      Path synctexPath = texFile.getSynctexPath();
      PdfPageIdentifier pageIdentifier = new PdfPageIdentifier(texFile);
      this.parser = new SyncTeXParser(synctexPath, pageIdentifier);
    }
    return this.parser.getMostCommonLineHeight();
  }

  /**
   * Returns the average line height.
   */
  public float getAverageLineHeight() {
    if (this.parser == null) {
      // Lazy loading.
      Path synctexPath = texFile.getSynctexPath();
      PdfPageIdentifier pageIdentifier = new PdfPageIdentifier(texFile);
      this.parser = new SyncTeXParser(synctexPath, pageIdentifier);
    }
    return this.parser.getAverageLineHeight();
  }
}
