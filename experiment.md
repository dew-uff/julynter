# Julynter Experiment

We would like to invite you to participate on an experiment about Julynter.

The experiment will be conducted remotely and you will just need to install a Python package, use Jupyter Lab for a week during the development of your own Python notebooks, and answer some questions by email later.

Please, read the [term of free and informed consent (TFIC](tfic.html) and fill the initial form to participate: [Google Forms](Todo).

## Configuring the tool

If you already answered the initial form, your **Participant ID** will be the email address you entered in the form. We will not share the address, but if you prefer to use a different ID, please contact us ([jpimentel@ic.uff.br](mailto:jpimentel@ic.uff.br)).

Now you need to install and configure Julynter for the experiment. Please follow these steps:

Install Julynter:
```
pip install julynter
```

Start the experiment:
```
julynter experiment start
```

It will ask you to authorize the collection of some usage data for the experiment. The most data you allow us to collect, better will be our capacity to contextualize the experimental trial.

Now, you can open Jupyter Lab and use Julynter for linting your notebooks in real time. If you have nodejs, you can run jupyter lab normally (`jupyter lab`) and it will ask you to rebuild to install the Julynter extension. Otherwise, use precompiled version of Jupyter Lab with Julynter installed:
```
julynter lab
```

Julynter appears on the left panel of Jupyter Lab as circle with a correct sign (![Julynter icon](img/julynter.png)). Open it after opening the notebook to start linting.

Please, use it during the development of your next notebooks. You may use it while adding new code to existing notebooks or creating new notebooks. Note, however, that most linting occurs when cells are executed. Thus, if you use it with an existing notebook, you need to re-execute its cells. During the experiment, you may work on the notebooks as you usually do (e.g., creating notebooks, adding, editing and removing cells, executing them) and you may apply the linting suggestions as well.

If you find a linting suggestion useful, please consider clicking in the plus icon that appears when you hover it. Otherwise, please consider clicking in the minus icon. You may also click in the dialog icon to send us a report.

If you just answered the form, we will contact you back in a week to ask about your experience with Julynter. Feel free to contact us any time.

If you do not have a notebook project to work on the following days, but still want to participate in this experiment, we can provide suggestions.

## Stopping Experiment

If you want to stop the experiment, please run and [contact us](mailto:jpimentel@ic.uff.br):
```
julynter experiment stop
```

