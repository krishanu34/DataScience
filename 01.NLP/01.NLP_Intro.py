{
  "nbformat": 4,
  "nbformat_minor": 0,
  "metadata": {
    "colab": {
      "provenance": [],
      "authorship_tag": "ABX9TyNYENpuIs5kroF459XVbQ5r",
      "include_colab_link": true
    },
    "kernelspec": {
      "name": "python3",
      "display_name": "Python 3"
    },
    "language_info": {
      "name": "python"
    }
  },
  "cells": [
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "view-in-github",
        "colab_type": "text"
      },
      "source": [
        "<a href=\"https://colab.research.google.com/github/krishanu34/DataScience/blob/main/01.NLP/01.NLP_Intro.py\" target=\"_parent\"><img src=\"https://colab.research.google.com/assets/colab-badge.svg\" alt=\"Open In Colab\"/></a>"
      ]
    },
    {
      "cell_type": "markdown",
      "source": [
        "# Tokenization, Corpus, Documents, Vocabulary, and Words in NLP\n",
        "\n",
        "## 1. Tokenization\n",
        "- **Tokenization** is the process of splitting text into smaller units called **tokens**.\n",
        "- Tokens can be words, subwords, or characters depending on the application.\n",
        "\n",
        "### Examples:\n",
        "- **Word-level tokenization**  \n",
        "Sentence: \"The cat sat on the mat.\"\n",
        "Tokens: [\"The\", \"cat\", \"sat\", \"on\", \"the\", \"mat\"]\n",
        "\n",
        "\n",
        "\n",
        "- **Character-level tokenization**  \n",
        "Sentence: \"cat\"\n",
        "Tokens: [\"c\", \"a\", \"t\"]\n",
        "\n",
        "\n",
        "\n",
        "- **Subword tokenization** (common in modern NLP models like BERT, GPT)  \n",
        "Word: \"unhappiness\"\n",
        "Tokens: [\"un\", \"happi\", \"ness\"]\n",
        "\n",
        "\n",
        "\n",
        "---\n",
        "\n",
        "## 2. Corpus\n",
        "- A **corpus** is a large collection of texts used for NLP tasks.\n",
        "- It serves as the dataset for training or analysis.\n",
        "- Example in our case:\n",
        "\n",
        "Corpus = [\n",
        "\"The cat sat on the mat.\",\n",
        "\"The dog barked loudly.\"\n",
        "]\n",
        "\n",
        "\n",
        "\n",
        "---\n",
        "\n",
        "## 3. Documents\n",
        "- A **document** is an individual text (sentence, paragraph, or article) inside the corpus.\n",
        "- Example:\n",
        "\n",
        "Document 1: \"The cat sat on the mat.\"\n",
        "\n",
        "Document 2: \"The dog barked loudly.\"\n",
        "\n",
        "\n",
        "\n",
        "---\n",
        "\n",
        "## 4. Words / Tokens in Documents\n",
        "- **Words (tokens)** are the individual terms obtained by applying tokenization to documents.\n",
        "- Usually preprocessed (lowercased, punctuation removed).\n",
        "- Example:\n",
        "\n",
        "Document 1 tokens: [\"the\", \"cat\", \"sat\", \"on\", \"the\", \"mat\"]\n",
        "\n",
        "Document 2 tokens: [\"the\", \"dog\", \"barked\", \"loudly\"]\n",
        "\n",
        "\n",
        "\n",
        "---\n",
        "\n",
        "## 5. Vocabulary\n",
        "- The **vocabulary** is the set of unique words across the entire corpus.\n",
        "- Example:\n",
        "\n",
        "Vocabulary = {\"the\", \"cat\", \"sat\", \"on\", \"mat\", \"dog\", \"barked\", \"loudly\"}\n",
        "\n",
        "\n",
        "- Vocabulary size = 8\n",
        "\n",
        "---\n",
        "\n",
        "## 🔑 Hierarchy Summary\n",
        "\n",
        "- **Corpus (2 documents)**  \n",
        "  - **Document 1** → tokens: [\"the\", \"cat\", \"sat\", \"on\", \"the\", \"mat\"]  \n",
        "  - **Document 2** → tokens: [\"the\", \"dog\", \"barked\", \"loudly\"]  \n",
        "\n",
        "- **Vocabulary** (unique words across documents):  \n",
        "  {\"the\", \"cat\", \"sat\", \"on\", \"mat\", \"dog\", \"barked\", \"loudly\"}"
      ],
      "metadata": {
        "id": "RFbdFVvWjx2l"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "! pip install nltk"
      ],
      "metadata": {
        "colab": {
          "base_uri": "https://localhost:8080/"
        },
        "id": "fah6BKkKls7C",
        "outputId": "001e647e-4c5f-4f33-c6a8-5585a8db2c40"
      },
      "execution_count": 1,
      "outputs": [
        {
          "output_type": "stream",
          "name": "stdout",
          "text": [
            "Requirement already satisfied: nltk in /usr/local/lib/python3.12/dist-packages (3.9.1)\n",
            "Requirement already satisfied: click in /usr/local/lib/python3.12/dist-packages (from nltk) (8.2.1)\n",
            "Requirement already satisfied: joblib in /usr/local/lib/python3.12/dist-packages (from nltk) (1.5.2)\n",
            "Requirement already satisfied: regex>=2021.8.3 in /usr/local/lib/python3.12/dist-packages (from nltk) (2024.11.6)\n",
            "Requirement already satisfied: tqdm in /usr/local/lib/python3.12/dist-packages (from nltk) (4.67.1)\n"
          ]
        }
      ]
    },
    {
      "cell_type": "code",
      "source": [
        "corpus = \"\"\"\n",
        "Natural language processing is a subfield of linguistics, computer science, and artificial intelligence.\n",
        "It is concerned with the interaction between computers and human (natural) languages!\n",
        "Specifically, it is concerned with programming computers to process and analyze large amounts of natural language data.\n",
        "Challenges in NLP include speech recognition, natural language understanding, and natural language generation.\n",
        "\"\"\""
      ],
      "metadata": {
        "id": "MsVUBL6mmKjZ"
      },
      "execution_count": 35,
      "outputs": []
    },
    {
      "cell_type": "code",
      "source": [
        "print(corpus)"
      ],
      "metadata": {
        "colab": {
          "base_uri": "https://localhost:8080/"
        },
        "id": "Sg39XEEBmtTj",
        "outputId": "051d137a-0545-4eb1-c8c2-973577294293"
      },
      "execution_count": 36,
      "outputs": [
        {
          "output_type": "stream",
          "name": "stdout",
          "text": [
            "\n",
            "Natural language processing is a subfield of linguistics, computer science, and artificial intelligence.\n",
            "It is concerned with the interaction between computers and human (natural) languages!\n",
            "Specifically, it is concerned with programming computers to process and analyze large amounts of natural language data.\n",
            "Challenges in NLP include speech recognition, natural language understanding, and natural language generation.\n",
            "\n"
          ]
        }
      ]
    },
    {
      "cell_type": "markdown",
      "source": [
        "#### Tokenization\n",
        "##### Sentence --> Paragraphs"
      ],
      "metadata": {
        "id": "R3-HGHHEm5Wl"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "from nltk.tokenize import sent_tokenize"
      ],
      "metadata": {
        "id": "KOHRMayzmt7n"
      },
      "execution_count": 37,
      "outputs": []
    },
    {
      "cell_type": "markdown",
      "source": [
        "Install this if you get error\n",
        "import nltk\n",
        "nltk.download('punkt_tab')"
      ],
      "metadata": {
        "id": "izeghoXosTEc"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "sentences = sent_tokenize(corpus)"
      ],
      "metadata": {
        "id": "fCUheHdBm0oH"
      },
      "execution_count": 38,
      "outputs": []
    },
    {
      "cell_type": "code",
      "source": [
        "for sentece in sentences:\n",
        "    print(sentece)"
      ],
      "metadata": {
        "id": "L6BQzQ-myPyO",
        "outputId": "8f00b667-7d11-430f-f120-cf1275ededff",
        "colab": {
          "base_uri": "https://localhost:8080/"
        }
      },
      "execution_count": 39,
      "outputs": [
        {
          "output_type": "stream",
          "name": "stdout",
          "text": [
            "\n",
            "Natural language processing is a subfield of linguistics, computer science, and artificial intelligence.\n",
            "It is concerned with the interaction between computers and human (natural) languages!\n",
            "Specifically, it is concerned with programming computers to process and analyze large amounts of natural language data.\n",
            "Challenges in NLP include speech recognition, natural language understanding, and natural language generation.\n"
          ]
        }
      ]
    },
    {
      "cell_type": "markdown",
      "source": [
        "#### Tokenization\n",
        "##### Paragrapgh --> Words\n",
        "##### Sentence --> Words"
      ],
      "metadata": {
        "id": "dcqyyAVgxmMP"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "from nltk.tokenize import word_tokenize"
      ],
      "metadata": {
        "id": "ubAJuisPnF9x"
      },
      "execution_count": 40,
      "outputs": []
    },
    {
      "cell_type": "code",
      "source": [
        "word_tokenize(corpus)"
      ],
      "metadata": {
        "id": "h0FAbS7bxw9G",
        "outputId": "94340b15-fa7e-44ab-ef83-d31743a8700b",
        "colab": {
          "base_uri": "https://localhost:8080/"
        }
      },
      "execution_count": 41,
      "outputs": [
        {
          "output_type": "execute_result",
          "data": {
            "text/plain": [
              "['Natural',\n",
              " 'language',\n",
              " 'processing',\n",
              " 'is',\n",
              " 'a',\n",
              " 'subfield',\n",
              " 'of',\n",
              " 'linguistics',\n",
              " ',',\n",
              " 'computer',\n",
              " 'science',\n",
              " ',',\n",
              " 'and',\n",
              " 'artificial',\n",
              " 'intelligence',\n",
              " '.',\n",
              " 'It',\n",
              " 'is',\n",
              " 'concerned',\n",
              " 'with',\n",
              " 'the',\n",
              " 'interaction',\n",
              " 'between',\n",
              " 'computers',\n",
              " 'and',\n",
              " 'human',\n",
              " '(',\n",
              " 'natural',\n",
              " ')',\n",
              " 'languages',\n",
              " '!',\n",
              " 'Specifically',\n",
              " ',',\n",
              " 'it',\n",
              " 'is',\n",
              " 'concerned',\n",
              " 'with',\n",
              " 'programming',\n",
              " 'computers',\n",
              " 'to',\n",
              " 'process',\n",
              " 'and',\n",
              " 'analyze',\n",
              " 'large',\n",
              " 'amounts',\n",
              " 'of',\n",
              " 'natural',\n",
              " 'language',\n",
              " 'data',\n",
              " '.',\n",
              " 'Challenges',\n",
              " 'in',\n",
              " 'NLP',\n",
              " 'include',\n",
              " 'speech',\n",
              " 'recognition',\n",
              " ',',\n",
              " 'natural',\n",
              " 'language',\n",
              " 'understanding',\n",
              " ',',\n",
              " 'and',\n",
              " 'natural',\n",
              " 'language',\n",
              " 'generation',\n",
              " '.']"
            ]
          },
          "metadata": {},
          "execution_count": 41
        }
      ]
    },
    {
      "cell_type": "code",
      "source": [
        "for sentece in sentences:\n",
        "    print(word_tokenize(sentece))"
      ],
      "metadata": {
        "id": "ywwcBlR8xzTW",
        "outputId": "78698c04-81ce-437b-afab-a621029ba0eb",
        "colab": {
          "base_uri": "https://localhost:8080/"
        }
      },
      "execution_count": 42,
      "outputs": [
        {
          "output_type": "stream",
          "name": "stdout",
          "text": [
            "['Natural', 'language', 'processing', 'is', 'a', 'subfield', 'of', 'linguistics', ',', 'computer', 'science', ',', 'and', 'artificial', 'intelligence', '.']\n",
            "['It', 'is', 'concerned', 'with', 'the', 'interaction', 'between', 'computers', 'and', 'human', '(', 'natural', ')', 'languages', '!']\n",
            "['Specifically', ',', 'it', 'is', 'concerned', 'with', 'programming', 'computers', 'to', 'process', 'and', 'analyze', 'large', 'amounts', 'of', 'natural', 'language', 'data', '.']\n",
            "['Challenges', 'in', 'NLP', 'include', 'speech', 'recognition', ',', 'natural', 'language', 'understanding', ',', 'and', 'natural', 'language', 'generation', '.']\n"
          ]
        }
      ]
    },
    {
      "cell_type": "code",
      "source": [
        "from nltk.tokenize import wordpunct_tokenize"
      ],
      "metadata": {
        "id": "REqdfkmTydNP"
      },
      "execution_count": 43,
      "outputs": []
    },
    {
      "cell_type": "code",
      "source": [
        "for sentece in sentences:\n",
        "    print(wordpunct_tokenize(sentece))"
      ],
      "metadata": {
        "id": "32YOBEg6yotW",
        "outputId": "86e54de1-402c-480a-d1dc-911b6201bcae",
        "colab": {
          "base_uri": "https://localhost:8080/"
        }
      },
      "execution_count": 44,
      "outputs": [
        {
          "output_type": "stream",
          "name": "stdout",
          "text": [
            "['Natural', 'language', 'processing', 'is', 'a', 'subfield', 'of', 'linguistics', ',', 'computer', 'science', ',', 'and', 'artificial', 'intelligence', '.']\n",
            "['It', 'is', 'concerned', 'with', 'the', 'interaction', 'between', 'computers', 'and', 'human', '(', 'natural', ')', 'languages', '!']\n",
            "['Specifically', ',', 'it', 'is', 'concerned', 'with', 'programming', 'computers', 'to', 'process', 'and', 'analyze', 'large', 'amounts', 'of', 'natural', 'language', 'data', '.']\n",
            "['Challenges', 'in', 'NLP', 'include', 'speech', 'recognition', ',', 'natural', 'language', 'understanding', ',', 'and', 'natural', 'language', 'generation', '.']\n"
          ]
        }
      ]
    },
    {
      "cell_type": "code",
      "source": [
        "from nltk.tokenize import TreebankWordTokenizer"
      ],
      "metadata": {
        "id": "3idcg5x2yqUG"
      },
      "execution_count": 45,
      "outputs": []
    },
    {
      "cell_type": "code",
      "source": [
        "tokenizer=TreebankWordTokenizer()"
      ],
      "metadata": {
        "id": "n0HeE0Eiyz-B"
      },
      "execution_count": 46,
      "outputs": []
    },
    {
      "cell_type": "code",
      "source": [
        "for sentece in sentences:\n",
        "    print(tokenizer.tokenize(sentece))"
      ],
      "metadata": {
        "id": "Y621nd-ly2lX",
        "outputId": "59223a63-7031-4498-ff6d-888adcbc6b35",
        "colab": {
          "base_uri": "https://localhost:8080/"
        }
      },
      "execution_count": 47,
      "outputs": [
        {
          "output_type": "stream",
          "name": "stdout",
          "text": [
            "['Natural', 'language', 'processing', 'is', 'a', 'subfield', 'of', 'linguistics', ',', 'computer', 'science', ',', 'and', 'artificial', 'intelligence', '.']\n",
            "['It', 'is', 'concerned', 'with', 'the', 'interaction', 'between', 'computers', 'and', 'human', '(', 'natural', ')', 'languages', '!']\n",
            "['Specifically', ',', 'it', 'is', 'concerned', 'with', 'programming', 'computers', 'to', 'process', 'and', 'analyze', 'large', 'amounts', 'of', 'natural', 'language', 'data', '.']\n",
            "['Challenges', 'in', 'NLP', 'include', 'speech', 'recognition', ',', 'natural', 'language', 'understanding', ',', 'and', 'natural', 'language', 'generation', '.']\n"
          ]
        }
      ]
    },
    {
      "cell_type": "code",
      "source": [],
      "metadata": {
        "id": "FE9REjQXy3yX"
      },
      "execution_count": 47,
      "outputs": []
    }
  ]
}